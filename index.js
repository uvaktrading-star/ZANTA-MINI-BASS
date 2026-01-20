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
const { connectDB, getBotSettings, updateSetting } = require("./plugins/bot_db");

// 🆕 Shared Logger instance එකක් හැදුවා (සෙෂන් 35කටම එකයි - RAM ඉතුරු වේ)
const logger = P({ level: "silent" });

const badMacTracker = new Map();
const activeSockets = new Set();
const lastWorkTypeMessage = new Map(); 

global.BOT_SESSIONS_CONFIG = {};

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

app.get("/update-cache", async (req, res) => {
    const userNumber = req.query.id;
    if (!userNumber) return res.status(400).send("No ID");
    try {
        const newData = await getBotSettings(userNumber);
        if (newData) {
            global.BOT_SESSIONS_CONFIG[userNumber] = newData;
            console.log(`♻️ Memory Synced for ${userNumber}`);
        }
        res.send("OK");
    } catch (e) {
        res.status(500).send("Error");
    }
});

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
            try { require(`./plugins/${plugin}`); } catch (e) { console.error(`[Loader] Error ${plugin}:`, e); }
        }
    });
    console.log(`✨ Loaded: ${commands.length} Commands`);
}

async function startSystem() {
    await connectDB(); 
    await loadPlugins();
    const allSessions = await Session.find({});
    console.log(`📂 Total sessions: ${allSessions.length}. Connecting...`);

    // 🆕 Batch size එක 4 කරලා Delay එක තත්පර 8ක් කළා
    const BATCH_SIZE = 4; 
    const DELAY_BETWEEN_BATCHES = 8000; 

    for (let i = 0; i < allSessions.length; i += BATCH_SIZE) {
        const batch = allSessions.slice(i, i + BATCH_SIZE);
        setTimeout(async () => {
            batch.forEach(sessionData => connectToWA(sessionData));
        }, (i / BATCH_SIZE) * DELAY_BETWEEN_BATCHES);
    }
    Session.watch().on('change', async (data) => {
        if (data.operationType === 'insert') await connectToWA(data.fullDocument);
    });
}

async function connectToWA(sessionData) {
    const userNumber = sessionData.number.split("@")[0];
    global.BOT_SESSIONS_CONFIG[userNumber] = await getBotSettings(userNumber);
    let userSettings = global.BOT_SESSIONS_CONFIG[userNumber];

    const authPath = path.join(__dirname, `/auth_info_baileys/${userNumber}/`);
    if (!fs.existsSync(authPath)) fs.mkdirSync(authPath, { recursive: true });
    try { fs.writeFileSync(path.join(authPath, "creds.json"), JSON.stringify(sessionData.creds)); } catch (e) {}

    const { state, saveCreds } = await useMultiFileAuthState(authPath);
    const { version } = await fetchLatestBaileysVersion();

    const zanta = makeWASocket({
        logger: logger, 
        printQRInTerminal: false,
        browser: Browsers.macOS("Firefox"),
        auth: state,
        version,
        syncFullHistory: false,                                     
        markOnlineOnConnect: userSettings.alwaysOnline === 'true',
        shouldSyncHistoryMessage: () => false, 
        getMessage: async (key) => { return { conversation: "ZANTA-MD" } }
    });

    activeSockets.add(zanta);

    zanta.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            activeSockets.delete(zanta);

            zanta.ev.removeAllListeners();
            if (zanta.onlineInterval) clearInterval(zanta.onlineInterval);

            const reason = lastDisconnect?.error?.output?.statusCode;
            const errorMsg = lastDisconnect?.error?.message || "";

            if (errorMsg.includes("Bad MAC") || errorMsg.includes("Encryption")) {
                let count = badMacTracker.get(userNumber) || 0;
                count++;
                badMacTracker.set(userNumber, count);
                if (count >= 3) {
                    await Session.deleteOne({ number: sessionData.number });
                    badMacTracker.delete(userNumber);
                } else { setTimeout(() => connectToWA(sessionData), 5000); }
            } else if (reason === DisconnectReason.loggedOut) {
                await Session.deleteOne({ number: sessionData.number });
            } else { setTimeout(() => connectToWA(sessionData), 5000); }

        } else if (connection === "open") {
            console.log(`✅ [${userNumber}] Connected Successfully`);
            badMacTracker.delete(userNumber);
            const ownerJid = decodeJid(zanta.user.id);

            if (!zanta.onlineInterval) {
                zanta.onlineInterval = setInterval(async () => {
                    const currentSet = global.BOT_SESSIONS_CONFIG[userNumber];
                    if (currentSet && currentSet.alwaysOnline === 'true') {
                        await zanta.sendPresenceUpdate('available');
                    } else {
                        await zanta.sendPresenceUpdate('unavailable');
                    }
                }, 20000); 
            }

            if (userSettings.connectionMsg === 'true') {
                await zanta.sendMessage(ownerJid, {
                    image: { url: `https://github.com/Akashkavindu/ZANTA_MD/blob/main/images/Gemini_Generated_Image_4xcl2e4xcl2e4xcl.png?raw=true` },
                    caption: `${userSettings.botName} connected ✅`,
                });
            }
        }
    });

    zanta.ev.on("creds.update", saveCreds);

    zanta.ev.on("messages.upsert", async ({ messages }) => {
        const mek = messages[0];
        if (!mek || !mek.message) return;

        userSettings = global.BOT_SESSIONS_CONFIG[userNumber];

        const type = getContentType(mek.message);
        const from = mek.key.remoteJid;
        const isGroup = from.endsWith("@g.us");

        let body = (type === "conversation") ? mek.message.conversation : (mek.message[type]?.text || mek.message[type]?.caption || "");

        let isButton = false;
        if (mek.message?.buttonsResponseMessage) {
            body = mek.message.buttonsResponseMessage.selectedButtonId;
            isButton = true;
        } else if (mek.message?.templateButtonReplyMessage) {
            body = mek.message.templateButtonReplyMessage.selectedId;
            isButton = true;
        } else if (mek.message?.listResponseMessage) {
            body = mek.message.listResponseMessage.singleSelectReply.selectedRowId;
            isButton = true;
        }

        const prefix = userSettings.prefix;
        const isCmd = body.startsWith(prefix) || isButton; 
        const isQuotedReply = mek.message[type]?.contextInfo?.quotedMessage;
        const sender = mek.key.fromMe ? zanta.user.id : (mek.key.participant || mek.key.remoteJid);

        if (from === "status@broadcast") {
            if (userSettings.autoStatusSeen === 'true') await zanta.readMessages([mek.key]);
            if (userSettings.autoStatusReact === 'true' && !mek.key.fromMe) {
                await zanta.sendMessage(from, { react: { text: "💚", key: mek.key } }, { statusJidList: [sender] });
            }
            return;
        }

        const senderNumber = decodeJid(sender).split("@")[0].replace(/[^\d]/g, '');
        const isOwner = mek.key.fromMe || senderNumber === config.OWNER_NUMBER.replace(/[^\d]/g, '');

        if (isCmd && userSettings.workType === 'private' && !isOwner) return;

        // Group Metadata Fetching Optimization (Fetch only when needed for Commands)
        let groupMetadata = {};
        let participants = [];
        let groupAdmins = []; 
        let isAdmins = false;
        let isBotAdmins = false;

        const m = sms(zanta, mek);

        // Auto Reply Section
        if (userSettings.autoReply === 'true' && userSettings.autoReplies && !isCmd && !mek.key.fromMe) {
            const chatMsg = body.toLowerCase().trim();
            const foundMatch = userSettings.autoReplies.find(ar => ar.keyword.toLowerCase().trim() === chatMsg);
            if (foundMatch) {
                await zanta.sendMessage(from, { text: foundMatch.reply }, { quoted: mek });
            }
        }

        // Identifying the Command
        let commandName = "";
        if (isButton) {
            let cleanId = body.startsWith(prefix) ? body.slice(prefix.length).trim() : body.trim();
            let foundCmd = commands.find(c => c.pattern === cleanId.split(" ")[0].toLowerCase() || (c.alias && c.alias.includes(cleanId.split(" ")[0].toLowerCase())));
            commandName = foundCmd ? cleanId.split(" ")[0].toLowerCase() : "menu";
        } else if (isCmd) {
            commandName = body.slice(prefix.length).trim().split(" ")[0].toLowerCase();
        }

        const args = isButton ? [body] : body.trim().split(/ +/).slice(1);

        if (userSettings.autoRead === 'true') await zanta.readMessages([mek.key]);
        if (userSettings.autoTyping === 'true') await zanta.sendPresenceUpdate('composing', from);
        if (userSettings.autoVoice === 'true' && !mek.key.fromMe) await zanta.sendPresenceUpdate('recording', from);

        const reply = (text) => zanta.sendMessage(from, { text }, { quoted: mek });

        const isSettingsReply = (m.quoted && lastSettingsMessage && lastSettingsMessage.get(from) === m.quoted.id);
        const isWorkTypeChoice = (m.quoted && lastWorkTypeMessage && lastWorkTypeMessage.get(from) === m.quoted.id);
        const isMenuReply = (m.quoted && lastMenuMessage && lastMenuMessage.get(from) === m.quoted.id);
        const isHelpReply = (m.quoted && lastHelpMessage && lastHelpMessage.get(from) === m.quoted.id);

        // Settings Handling
        if (isWorkTypeChoice && body && !isCmd && isOwner) {
            let choice = body.trim();
            let finalValue = (choice === '1') ? 'public' : (choice === '2') ? 'private' : null;
            if (finalValue) {
                await updateSetting(userNumber, 'workType', finalValue);
                if (userSettings) userSettings.workType = finalValue;
                global.BOT_SESSIONS_CONFIG[userNumber] = userSettings;
                lastWorkTypeMessage.delete(from); 
                return reply(`✅ *WORK_TYPE* updated to: *${finalValue.toUpperCase()}*`);
            } else {
                return reply("⚠️ වැරදි අංකයක්. කරුණාකර `1` (Public) හෝ `2` (Private) ලෙස රිප්ලයි කරන්න.");
            }
        }

        if (isSettingsReply && body && !isCmd && isOwner) {
            const input = body.trim().split(" ");
            let index = parseInt(input[0]);
            let dbKeys = ["", "botName", "ownerName", "prefix", "workType", "password", "alwaysOnline", "autoRead", "autoTyping", "autoStatusSeen", "autoStatusReact", "readCmd", "autoVoice", "autoReply", "connectionMsg", "buttons"];
            let dbKey = dbKeys[index];
            if (dbKey) {
                if (index === 4) {
                    const workMsg = await reply("🛠️ *SELECT WORK MODE*\n\nකරුණාකර අංකය පමණක් රිප්ලයි කරන්න:\n1️⃣ *Public*\n2️⃣ *Private*\n\n> *ZANTA-MD Settings Control*");
                    lastWorkTypeMessage.set(from, workMsg.key.id); 
                    return;
                }
                if (index === 13 && input.length === 1) {
                    let siteMsg = `📝 *ZANTA-MD AUTO REPLY SETTINGS*\n\nඔබේ බොට් සඳහා Auto Reply මැසේජ් සෑදීමට පහත Link එකට පිවිසෙන්න.\n\n🔗 *Link:* https://chic-puppy-62f8d1.netlify.app/\n\n*Status:* ${userSettings.autoReply === 'true' ? '✅ ON' : '❌ OFF'}`;
                    return reply(siteMsg);
                }
                if (input.length < 2) return reply(`⚠️ කරුණාකර අගයක් ලබා දෙන්න.\n*E.g:* \`${index} on\` හෝ \`${index} value\``);
                let finalValue = index >= 6 ? (input[1].toLowerCase() === 'on' ? 'true' : 'false') : input.slice(1).join(" ");
                await updateSetting(userNumber, dbKey, finalValue);
                if (userSettings) userSettings[dbKey] = finalValue;
                global.BOT_SESSIONS_CONFIG[userNumber] = userSettings;
                if (dbKey === "alwaysOnline") await zanta.sendPresenceUpdate(finalValue === 'true' ? 'available' : 'unavailable', from);
                if (dbKey === "password") {
                    let passMsg = `🔐 *WEB SITE PASSWORD UPDATED* 🔐\n\n🔑 *New Password:* ${finalValue}\n👤 *User ID:* ${userNumber}\n\n🌐 *Link:* https://chic-puppy-62f8d1.netlify.app/`;
                    await reply(passMsg);
                } else {
                    await reply(`✅ *${dbKey}* updated to: *${finalValue.toUpperCase()}*`);
                }
                return;
            }
        }

        // Command Execution with Metadata Optimization
        if (isCmd || isMenuReply || isHelpReply || isButton) {
            const execName = isHelpReply ? 'help' : (isMenuReply || (isButton && commandName === "menu") ? 'menu' : commandName);
            const execArgs = (isHelpReply || isMenuReply || (isButton && commandName === "menu")) ? [body.trim().toLowerCase()] : args;
            const cmd = commands.find(c => c.pattern === execName || (c.alias && c.alias.includes(execName)));

            if (cmd) {
                // Fetch Group Metadata ONLY when a valid command is found and it's a Group
                if (isGroup) {
                    try {
                        groupMetadata = await zanta.groupMetadata(from).catch(e => ({}));
                        participants = groupMetadata.participants || [];
                        groupAdmins = getGroupAdmins(participants); 
                        const cleanSender = decodeJid(sender);
                        const cleanBot = decodeJid(zanta.user.id);
                        const cleanAdmins = groupAdmins.map(v => decodeJid(v));
                        isAdmins = cleanAdmins.includes(cleanSender);
                        isBotAdmins = cleanAdmins.includes(cleanBot);
                    } catch (e) {
                        console.log("Error Fetching Group Metadata: ", e);
                    }
                }

                if (userSettings.readCmd === 'true') await zanta.readMessages([mek.key]);
                if (cmd.react && !isButton) zanta.sendMessage(from, { react: { text: cmd.react, key: mek.key } });

                try {
                    await cmd.function(zanta, mek, m, {
                        from, body, isCmd, command: execName, args: execArgs, q: execArgs.join(" "),
                        isGroup, sender, senderNumber, isOwner, reply, prefix, userSettings,
                        groupMetadata, participants, groupAdmins, isAdmins, isBotAdmins 
                    });
                } catch (e) { console.error(e); }
            }
        }
    });
}

startSystem();
app.get("/", (req, res) => res.send("ZANTA-MD Online ✅"));
app.listen(port);

setTimeout(async () => {
    console.log("♻️ [RESTART] Cleaning up active connections...");
    for (const socket of activeSockets) {
        try { 
            socket.ev.removeAllListeners();
            await socket.end(); 
        } catch (e) {}
    }
    setTimeout(() => {
        console.log("🚀 Exiting for scheduled restart.");
        process.exit(0);
    }, 5000);
}, 40 * 60 * 1000);
