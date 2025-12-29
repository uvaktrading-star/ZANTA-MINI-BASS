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
const { ytsLinks } = require("./plugins/yts"); // 🆕 YTS Reply Logic සඳහා
const { connectDB, getBotSettings, updateSetting } = require("./plugins/bot_db");

// --- MongoDB Schemas ---
const SessionSchema = new mongoose.Schema({
    number: { type: String, required: true, unique: true },
    creds: { type: Object, required: true }
}, { collection: 'sessions' });
const Session = mongoose.models.Session || mongoose.model("Session", SessionSchema);

// 🛡️ Anti-Delete Temp Messages Schema (විනාඩි 15කින් Auto-Delete වේ)
const TempMsgSchema = new mongoose.Schema({
    msgId: { type: String, required: true, index: true },
    data: { type: Object, required: true },
    createdAt: { type: Date, default: Date.now, expires: 900 } 
}, { collection: 'temp_messages' });
const TempMsg = mongoose.models.TempMsg || mongoose.model("TempMsg", TempMsgSchema);

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

// 🔇 Logs අවම කිරීම (අත්‍යවශ්‍ය නොවන warnings ඉවත් කරයි)
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
        logger: P({ level: "fatal" }), // 🔇 අනවශ්‍ය logs සම්පූර්ණයෙන්ම නවත්වයි
        printQRInTerminal: false,
        browser: Browsers.macOS("Firefox"),
        auth: state,
        version,
        syncFullHistory: false,
        markOnlineOnConnect: false,
        generateHighQualityLinkPreview: true,
        getMessage: async (key) => {
            const stored = await TempMsg.findOne({ msgId: key.id });
            return stored ? stored.data.message : { conversation: "ZANTA-MD Anti-Delete" };
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

        // --- 🛡️ MONGO-BASED ANTI-DELETE ---
        if (type === 'protocolMessage' && mek.message.protocolMessage.type === 0) {
            if (userSettings.antiDelete === 'true') {
                const key = mek.message.protocolMessage.key;
                const storedMsg = await TempMsg.findOne({ msgId: key.id });

                if (storedMsg && !storedMsg.data.key.fromMe) {
                    const participant = key.participant || key.remoteJid;
                    await zanta.relayMessage(from, storedMsg.data.message, { messageId: storedMsg.msgId });
                    await zanta.sendMessage(from, { text: `*🚨 Anti-Delete:* Message from @${participant.split('@')[0]} restored.`, mentions: [participant] }, { quoted: storedMsg.data });
                }
            }
            return;
        }
        // Messages ඩේටාබේස් එකේ සේව් කිරීම (විනාඩි 15කට පමණයි)
        if (mek.key.id && !mek.key.fromMe && type !== 'protocolMessage') {
            await TempMsg.updateOne({ msgId: mek.key.id }, { $set: { data: mek } }, { upsert: true });
        }

        if (userSettings.autoStatusSeen === 'true' && from === "status@broadcast") {
            await zanta.readMessages([mek.key]);
            return;
        }

        mek.message = getContentType(mek.message) === "ephemeralMessage" 
            ? mek.message.ephemeralMessage.message : mek.message;

        const m = sms(zanta, mek);
        const body = (type === "conversation") ? mek.message.conversation : (mek.message[type]?.text || mek.message[type]?.caption || "");

        const prefix = userSettings.prefix;
        const isCmd = body.startsWith(prefix);
        const commandName = isCmd ? body.slice(prefix.length).trim().split(" ")[0].toLowerCase() : "";
        const args = body.trim().split(/ +/).slice(1);

        const sender = mek.key.fromMe ? zanta.user.id : (mek.key.participant || mek.key.remoteJid);
        const senderNumber = decodeJid(sender).split("@")[0].replace(/[^\d]/g, '');
        const isOwner = mek.key.fromMe || senderNumber === config.OWNER_NUMBER.replace(/[^\d]/g, '');

        if (userSettings.autoRead === 'true') await zanta.readMessages([mek.key]);
        if (userSettings.autoTyping === 'true') await zanta.sendPresenceUpdate('composing', from);
        if (userSettings.autoVoice === 'true' && !mek.key.fromMe) await zanta.sendPresenceUpdate('recording', from);

        const isGroup = from.endsWith("@g.us");
        const groupMetadata = isGroup ? await zanta.groupMetadata(from).catch(() => ({})) : {};
        const participants = isGroup ? groupMetadata.participants : [];
        const groupAdmins = isGroup ? participants.filter(p => p.admin !== null).map(p => p.id) : [];
        const isAdmins = isGroup ? groupAdmins.includes(sender) : false;

        // 🛡️ ANTI-BADWORD (ඔයාගේ Original Feature එක)
        if (isGroup && userSettings.antiBadword === 'true' && !isAdmins && !isOwner) {
            const badWords = ["fuck", "sex", "porn", "හුකන", "පොන්න", "පුක", "බැල්ලි", "කුණුහරුප", "huththa", "pakaya", "ponnayo", "hukanno", "kariyo" , "kariya", "hukanna", "wezi", "hutta", "ponnaya", "balla"]; 
            if (badWords.some(word => body.toLowerCase().includes(word))) {
                await zanta.sendMessage(from, { delete: mek.key });
                await zanta.sendMessage(from, { text: `⚠️ *@${senderNumber} ඔබේ පණිවිඩය ඉවත් කරන ලදී!*`, mentions: [sender] });
                return;
            }
        }

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
            let dbKeys = ["", "botName", "ownerName", "prefix", "autoRead", "autoTyping", "autoStatusSeen", "alwaysOnline", "readCmd", "autoVoice" , "antiBadword", "antiDelete"];
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
