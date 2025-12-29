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

// (Anti-Delete TempMsg Schema එක අයින් කරන ලදී)

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
const port = process.env.PORT || 8000;

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

async function startSystem() {
    await connectDB(); 
    await loadPlugins();

    const allSessions = await Session.find({});
    console.log(`📂 Connecting ${allSessions.length} sessions...`);

    for (let sessionData of allSessions) {
        await connectToWA(sessionData);
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
        logger: P({ level: "fatal" }), 
        printQRInTerminal: false,
        browser: Browsers.macOS("Firefox"),
        auth: state,
        version,
        syncFullHistory: false,
        markOnlineOnConnect: false,
        generateHighQualityLinkPreview: true,
        getMessage: async (key) => {
            return { conversation: "ZANTA-MD" };
        }
    });

    zanta.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason === DisconnectReason.loggedOut) {
                await Session.deleteOne({ number: sessionData.number });
            } else {
                connectToWA(sessionData);
            }
        } else if (connection === "open") {
            console.log(`✅ [${userNumber}] Connected`);
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

        // --- (Anti-Delete Logic අයින් කරන ලදී) ---

        if (userSettings.autoStatusSeen === 'true' && from === "status@broadcast") {
            await zanta.readMessages([mek.key]);
            return;
        }

        mek.message = getContentType(mek.message) === "ephemeralMessage" 
            ? mek.message.ephemeralMessage.message : mek.message;

        const sender = mek.key.fromMe ? zanta.user.id : (mek.key.participant || mek.key.remoteJid);
        const senderNumber = decodeJid(sender).split("@")[0].replace(/[^\d]/g, '');
        const isOwner = mek.key.fromMe || senderNumber === config.OWNER_NUMBER.replace(/[^\d]/g, '');

        // --- 🛡️ ANTI-BADWORD ---
        if (isGroup && userSettings.antiBadword === 'true' && !isOwner) {
            const badWords = ["fuck", "sex", "porn", "හුකන", "පොන්න", "පුක", "බැල්ලි", "කුණුහරුප", "huththa", "pakaya", "ponnayo", "hukanno", "kariyo" , "kariya", "hukanna", "wezi", "hutta", "ponnaya", "balla"]; 
            if (badWords.some(word => body.toLowerCase().includes(word))) {
                const groupMetadata = await zanta.groupMetadata(from).catch(() => ({}));
                const participants = groupMetadata.participants || [];
                const isAdmins = participants.filter(p => p.admin !== null).map(p => p.id).includes(sender);
                
                if (!isAdmins) {
                    await zanta.sendMessage(from, { delete: mek.key });
                    await zanta.sendMessage(from, { text: `⚠️ *@${senderNumber} ඔබේ පණිවිඩය ඉවත් කරන ලදී!*`, mentions: [sender] });
                    return; 
                }
            }
        }

        // --- 🚀 SPEED FILTER ---
        if (isGroup && !isCmd && !isQuotedReply) return;

        const m = sms(zanta, mek);
        const commandName = isCmd ? body.slice(prefix.length).trim().split(" ")[0].toLowerCase() : "";
        const args = body.trim().split(/ +/).slice(1);

        if (userSettings.autoRead === 'true') await zanta.readMessages([mek.key]);
        if (userSettings.autoTyping === 'true') await zanta.sendPresenceUpdate('composing', from);
        if (userSettings.autoVoice === 'true' && !mek.key.fromMe) await zanta.sendPresenceUpdate('recording', from);

        const groupMetadata = isGroup ? await zanta.groupMetadata(from).catch(() => ({})) : {};
        const participants = isGroup ? groupMetadata.participants : [];
        const groupAdmins = isGroup ? participants.filter(p => p.admin !== null).map(p => p.id) : [];
        const isAdmins = isGroup ? groupAdmins.includes(sender) : false;

        const reply = (text) => zanta.sendMessage(from, { text }, { quoted: mek });
        
        // --- 🔎 YTS REPLY LOGIC ---
        if (m.quoted && ytsLinks && ytsLinks.has(m.quoted.id)) {
            const selection = parseInt(m.body.trim());
            const links = ytsLinks.get(m.quoted.id);
            if (!isNaN(selection) && selection <= links.length) {
                const video = links[selection - 1];
                if (video.seconds > 900) return reply("⚠️ විනාඩි 15කට වඩා වැඩි වීඩියෝ බාගත කළ නොහැක.");
                const cmdVideo = commands.find(c => c.pattern === 'video');
                if (cmdVideo) cmdVideo.function(zanta, mek, m, { from, q: video.url, userSettings, reply, isOwner, prefix });
                return;
            }
        }

        // --- ⚙️ SETTINGS REPLY LOGIC ---
        const isSettingsReply = (m.quoted && lastSettingsMessage && lastSettingsMessage.get(from) === m.quoted.id);
        if (isSettingsReply && body && !isCmd && isOwner) {
            const input = body.trim().split(" ");
            let dbKeys = ["", "botName", "ownerName", "prefix", "autoRead", "autoTyping", "autoStatusSeen", "alwaysOnline", "readCmd", "autoVoice" , "antiBadword"];
            let dbKey = dbKeys[parseInt(input[0])];
            if (dbKey) {
                let finalValue = (parseInt(input[0]) >= 4) ? (input[1] === 'on' ? 'true' : 'false') : input.slice(1).join(" ");
                await updateSetting(userNumber, dbKey, finalValue);
                userSettings[dbKey] = finalValue;
                await reply(`✅ *${dbKey}* updated to: *${finalValue}*`);
                return;
            }
        }

        // --- COMMAND HANDLER ---
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
    });
}

startSystem();
app.get("/", (req, res) => res.send("ZANTA-MD Online ✅"));
app.listen(port);
