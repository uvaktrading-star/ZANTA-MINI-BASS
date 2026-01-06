const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    jidNormalizedUser,
    getContentType,
    fetchLatestBaileysVersion,
    Browsers,
    generateForwardMessageContent,
    prepareWAMessageMedia
} = require("@whiskeysockets/baileys");

const fs = require("fs");
const P = require("pino");
const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const config = require("./config");
const { sms } = require("./lib/msg");
const { getGroupAdmins } = require("./lib/functions");
const { commands, replyHandlers } = require("./command");

const { lastMenuMessage } = require("./plugins/menu");
const { lastSettingsMessage } = require("./plugins/settings"); 
const { lastHelpMessage } = require("./plugins/help"); 
const { ytsLinks } = require("./plugins/yts"); 
const { connectDB, getBotSettings, updateSetting } = require("./plugins/bot_db");

// --- MongoDB Schemas ---
const SessionSchema = new mongoose.Schema({
    number: { type: String, required: true, unique: true },
    creds: { type: Object, required: true }
}, { collection: 'sessions' });
const Session = mongoose.models.Session || mongoose.model("Session", SessionSchema);

const decodeJid = (jid) => {
    if (!jid) return jid;
    if (/:\d+@/gi.test(jid)) {
        const decode = jid.split(':');
        return (decode[0] + '@' + decode[1].split('@')[1]) || jid;
    }
    return jid;
};

global.CURRENT_BOT_SETTINGS = {
    botName: config.DEFAULT_BOT_NAME,
    ownerName: config.DEFAULT_OWNER_NAME,
    prefix: config.DEFAULT_PREFIX,
};

const app = express();
const port = process.env.PORT || 5000;

process.on('uncaughtException', (err) => {
    if (err.message.includes('Connection Closed') || err.message.includes('EPIPE')) return;
    console.error('⚠️ Exception:', err);
});
process.on('unhandledRejection', (reason) => {
    if (reason?.message?.includes('Connection Closed') || reason?.message?.includes('Unexpected end')) return;
});

async function loadPlugins() {
    const pluginsPath = path.join(__dirname, "plugins");
    fs.readdirSync(pluginsPath).forEach((plugin) => {
        if (path.extname(plugin).toLowerCase() === ".js") {
            try {
                require(`./plugins/${plugin}`);
            } catch (e) {
                console.error(`[Loader] Error ${plugin}:`, e);
            }
        }
    });
    console.log(`✨ Loaded: ${commands.length} Commands`);
}

// --- 🚀 IMPROVED BATCH START SYSTEM ---
async function startSystem() {
    await connectDB(); 
    await loadPlugins();

    const allSessions = await Session.find({});
    console.log(`📂 Total sessions: ${allSessions.length}. Connecting in batches...`);

    const BATCH_SIZE = 4; 
    const DELAY_BETWEEN_BATCHES = 8000; 

    for (let i = 0; i < allSessions.length; i += BATCH_SIZE) {
        const batch = allSessions.slice(i, i + BATCH_SIZE);
        
        setTimeout(async () => {
            console.log(`🚀 Starting Batch (${i + 1} to ${Math.min(i + BATCH_SIZE, allSessions.length)})...`);
            batch.forEach(sessionData => connectToWA(sessionData));
        }, (i / BATCH_SIZE) * DELAY_BETWEEN_BATCHES);
    }

    Session.watch().on('change', async (data) => {
        if (data.operationType === 'insert') {
            await connectToWA(data.fullDocument);
        }
    });
}

async function connectToWA(sessionData) {
    const userNumber = sessionData.number.split("@")[0];
    let userSettings = await getBotSettings(userNumber);

    const authPath = path.join(__dirname, `/auth_info_baileys/${userNumber}/`);
    if (!fs.existsSync(authPath)) fs.mkdirSync(authPath, { recursive: true });

    try {
        fs.writeFileSync(path.join(authPath, "creds.json"), JSON.stringify(sessionData.creds));
    } catch (e) {}

    const { state, saveCreds } = await useMultiFileAuthState(authPath);
    const { version } = await fetchLatestBaileysVersion();

    const zanta = makeWASocket({
        logger: P({ level: "silent" }), 
        printQRInTerminal: false,
        browser: Browsers.macOS("Firefox"),
        auth: state,
        version,
        
        syncFullHistory: false,            
        markOnlineOnConnect: false,        
        shouldSyncHistoryMessage: () => false, 
        
        getMessage: async (key) => { return { conversation: "ZANTA-MD" } },
        cachedGroupMetadata: async (jid) => { return undefined } 
    });

    zanta.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            const reason = lastDisconnect?.error?.output?.statusCode;
            const errorMsg = lastDisconnect?.error?.message || "";

            if (reason === DisconnectReason.loggedOut || errorMsg.includes("Bad MAC") || errorMsg.includes("Encryption")) {
                console.log(`❌ [${userNumber}] Session Error (Bad MAC/Logout). Removing from DB...`);
                await Session.deleteOne({ number: sessionData.number });
            } else {
                setTimeout(() => connectToWA(sessionData), 5000);
            }
        } else if (connection === "open") {
            console.log(`✅ [${userNumber}] Connected Successfully`);
            const ownerJid = decodeJid(zanta.user.id);
            await zanta.sendMessage(ownerJid, {
                image: { url: `https://github.com/Akashkavindu/ZANTA_MD/blob/main/images/alive-new.jpg?raw=true` },
                caption: `${userSettings.botName} connected ✅`,
            });
        }
    });

    zanta.ev.on("creds.update", saveCreds);

    zanta.ev.on("messages.upsert", async ({ messages }) => {
        const mek = messages[0];
        if (!mek || !mek.message) return;

        const type = getContentType(mek.message);
        const from = mek.key.remoteJid;
        const isGroup = from.endsWith("@g.us");
        const body = (type === "conversation") ? mek.message.conversation : (mek.message[type]?.text || mek.message[type]?.caption || "");
        const prefix = userSettings.prefix;
        const isCmd = body.startsWith(prefix);
        const isQuotedReply = mek.message[type]?.contextInfo?.quotedMessage;
        const sender = mek.key.fromMe ? zanta.user.id : (mek.key.participant || mek.key.remoteJid);

        // --- 📱 AUTO STATUS SEEN & REACT (LIKE) ---
        if (from === "status@broadcast") {
            if (userSettings.autoStatusSeen === 'true') {
                await zanta.readMessages([mek.key]);
            }
            if (userSettings.autoStatusReact === 'true') {
                await zanta.sendMessage(from, {
                    react: { text: "💚", key: mek.key }
                }, { statusJidList: [sender] });
            }
            return;
        }

        mek.message = getContentType(mek.message) === "ephemeralMessage" 
            ? mek.message.ephemeralMessage.message : mek.message;

        const senderNumber = decodeJid(sender).split("@")[0].replace(/[^\d]/g, '');
        const isOwner = mek.key.fromMe || senderNumber === config.OWNER_NUMBER.replace(/[^\d]/g, '');

        if (isGroup && !isCmd && !isQuotedReply) return;

        const m = sms(zanta, mek);
        const commandName = isCmd ? body.slice(prefix.length).trim().split(" ")[0].toLowerCase() : "";
        const args = body.trim().split(/ +/).slice(1);

        if (userSettings.autoRead === 'true') await zanta.readMessages([mek.key]);
        if (userSettings.autoTyping === 'true') await zanta.sendPresenceUpdate('composing', from);
        if (userSettings.autoVoice === 'true' && !mek.key.fromMe) await zanta.sendPresenceUpdate('recording', from);

        let groupMetadata = {};
        let participants = [];
        let groupAdmins = [];
        let isAdmins = false;

        if (isGroup && (isCmd || isQuotedReply)) {
            try {
                groupMetadata = await zanta.groupMetadata(from);
                participants = groupMetadata.participants || [];
                const currentUser = participants.find(p => p.id === sender);
                isAdmins = currentUser && (currentUser.admin === 'admin' || currentUser.admin === 'superadmin');
                groupAdmins = participants.filter(p => p.admin !== null).map(p => p.id);
            } catch (e) {
                console.error("Metadata Error:", e);
            }
        }

        const reply = (text) => zanta.sendMessage(from, { text }, { quoted: mek });
        
        if (m.quoted && ytsLinks && ytsLinks.has(m.quoted.id)) {
            const selection = parseInt(m.body.trim());
            const links = ytsLinks.get(m.quoted.id);
            if (!isNaN(selection) && selection <= links.length) {
                const video = links[selection - 1];
                if (video.seconds > 900) return reply("⚠️ විනාඩි 15කට වඩා වැඩි වීඩියෝ බාගත කළ නොහැක.");
                await m.react("📥");
                const { ytmp4 } = require("@vreden/youtube_scraper");
                try {
                    const videoData = await ytmp4(video.url, "360"); 
                    if (!videoData || !videoData.download || !videoData.download.url) {
                        return reply("❌ ඩවුන්ලෝඩ් ලින්ක් එක ලබා ගැනීමට නොහැකි විය.");
                    }
                    await zanta.sendMessage(from, {
                        video: { url: videoData.download.url },
                        caption: `🎬 *${video.title}*\n🔗 ${video.url}\n\n> *© ${userSettings.botName || 'ZANTA-MD'}*`,
                        mimetype: 'video/mp4',
                        fileName: `${video.title}.mp4`
                    }, { quoted: mek });
                    await m.react("✅");
                } catch (e) {
                    reply("❌ වීඩියෝව බාගත කිරීමේදී දෝෂයක් සිදු විය.");
                }
                return;
            }
        }

        const isSettingsReply = (m.quoted && lastSettingsMessage && lastSettingsMessage.get(from) === m.quoted.id);
if (isSettingsReply && body && !isCmd && isOwner) {
    const input = body.trim().split(" ");
    
    let dbKeys = ["", "botName", "ownerName", "prefix", "password", "autoRead", "autoTyping", "autoStatusSeen", "autoStatusReact", "readCmd", "autoVoice"];
    
    let index = parseInt(input[0]);
    let dbKey = dbKeys[index];

    if (dbKey) {
        let finalValue;

        // 5 සහ ඊට ඉහළ ඒවා පමණක් on/off (Boolean) ලෙස සලකන්න
        if (index >= 5) {
            finalValue = (input[1] === 'on' ? 'true' : 'false');
        } else {
            // botName, ownerName, prefix සහ Password (index 1-4) Text ලෙස සලකන්න
            finalValue = input.slice(1).join(" ");
        }

        await updateSetting(userNumber, dbKey, finalValue);
        
        // Local cache එක update කිරීම
        if (userSettings) {
            userSettings[dbKey] = finalValue;
        }

        await reply(`✅ *${dbKey}* updated to: *${finalValue}*`);
        return;
    }
}

        const isMenuReply = (m.quoted && lastMenuMessage && lastMenuMessage.get(from) === m.quoted.id);
        const isHelpReply = (m.quoted && lastHelpMessage && lastHelpMessage.get(from) === m.quoted.id);

        if (isCmd || isMenuReply || isHelpReply) {
            const execName = isHelpReply ? 'help' : (isMenuReply ? 'menu' : commandName);
            const execArgs = (isHelpReply || isMenuReply) ? [body.trim().toLowerCase()] : args;
            const cmd = commands.find(c => c.pattern === execName || (c.alias && c.alias.includes(execName)));

            if (cmd) {
                if (userSettings.readCmd === 'true') await zanta.readMessages([mek.key]);
                if (cmd.react) zanta.sendMessage(from, { react: { text: cmd.react, key: mek.key } });
                try {
                    await cmd.function(zanta, mek, m, {
                        from, body, isCmd, command: execName, args: execArgs, q: execArgs.join(" "),
                        isGroup, sender, senderNumber, isOwner, groupMetadata, participants,
                        groupAdmins, isAdmins, reply, prefix, userSettings 
                    });
                } catch (e) { console.error(e); }
            }
        }
        
        if (global.gc) { global.gc(); }
    });
}

startSystem();
app.get("/", (req, res) => res.send("ZANTA-MD Online ✅"));
app.listen(port);

const MINUTES = 90; 
const RESTART_INTERVAL = MINUTES * 60 * 1000; 
setTimeout(() => {
    process.exit(0); 
}, RESTART_INTERVAL);
