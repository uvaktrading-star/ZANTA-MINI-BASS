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

const logger = P({ level: "silent" });
const badMacTracker = new Map();
const activeSockets = new Set();
const lastWorkTypeMessage = new Map(); 

const msgStorage = new Map();

global.activeSockets = new Set();
global.BOT_SESSIONS_CONFIG = {};

const SessionSchema = new mongoose.Schema({
    number: { type: String, required: true, unique: true },
    creds: { type: Object, default: null },
    status: { type: String, default: 'active' }
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
    } catch (e) { res.status(500).send("Error"); }
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

    const start = parseInt(process.env.START_RANGE) || 0;
    const end = parseInt(process.env.END_RANGE) || 60;

    const allSessions = await Session.find({}).sort({ _id: 1 });
    const myBatch = allSessions.slice(start, end);

    console.log(`📂 Total DB Sessions: ${allSessions.length}`);
    console.log(`🚀 Instance Range: ${start} to ${end} (Handling ${myBatch.length} users)`);

    const BATCH_SIZE = 4; 
    const DELAY_BETWEEN_BATCHES = 8000; 

    for (let i = 0; i < myBatch.length; i += BATCH_SIZE) {
        const batch = myBatch.slice(i, i + BATCH_SIZE);
        setTimeout(async () => {
            batch.forEach(sessionData => {
                if (sessionData.creds && sessionData.status !== 'inactive') {
                    connectToWA(sessionData);
                }
            });
        }, (i / BATCH_SIZE) * DELAY_BETWEEN_BATCHES);
    }

    Session.watch().on('change', async (data) => {
        if (data.operationType === 'insert' || data.operationType === 'update') {
            let sessionData;
            if (data.operationType === 'insert') {
                sessionData = data.fullDocument;
            } else {
                sessionData = await Session.findById(data.documentKey._id);
            }

            if (!sessionData || !sessionData.creds) return;

            if (sessionData.status === 'inactive') {
                await Session.updateOne({ _id: sessionData._id }, { status: 'active' });
                sessionData.status = 'active'; 
            }

            const currentList = await Session.find({}).sort({ _id: 1 });
            const userIndex = currentList.findIndex(s => s._id.toString() === sessionData._id.toString());

            if (userIndex >= start && userIndex < end) {
                const userNumberOnly = sessionData.number.split("@")[0];
                const isAlreadyActive = Array.from(activeSockets).some(s => 
                    s.user && decodeJid(s.user.id).includes(userNumberOnly)
                );

                if (!isAlreadyActive) {
                    console.log(`♻️ Session [${userNumberOnly}] re-activated or new. Connecting...`);
                    await connectToWA(sessionData);
                }
            }
        }
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
        shouldSyncHistoryMessage: () => false, 
        // --- [ADDED: Newsletter Logic Support] ---
        ignoreNewsletterMessages: false,
        emitOwnEvents: true,
        // ------------------------------------------
        markOnlineOnConnect: userSettings.alwaysOnline === 'true',
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
                    await Session.updateOne({ number: sessionData.number }, { creds: null, status: 'inactive' });
                    badMacTracker.delete(userNumber);
                } else { setTimeout(() => connectToWA(sessionData), 5000); }
            } else if (reason === DisconnectReason.loggedOut) {
                await Session.updateOne({ number: sessionData.number }, { creds: null, status: 'inactive' });
            } else { setTimeout(() => connectToWA(sessionData), 5000); }

        } else if (connection === "open") {
            console.log(`✅ [${userNumber}] Connected Successfully`);

            try {
                await zanta.newsletterFollow("120363406265537739@newsletter");
            } catch (e) { }

            try {
                const files = fs.readdirSync(authPath);
                for (const file of files) {
                    if (file.startsWith('pre-key-') || file.startsWith('sender-key-')) {
                        if (file !== 'creds.json') fs.unlinkSync(path.join(authPath, file));
                    }
                }
                console.log(`🧹 [${userNumber}] RAM Cleaned (Unused Keys Removed)`);
            } catch (err) { }

            badMacTracker.delete(userNumber);
            const ownerJid = decodeJid(zanta.user.id);

            if (userSettings.alwaysOnline === 'true') {
                await zanta.sendPresenceUpdate('available');
                await zanta.presenceSubscribe(ownerJid); 
            }

            if (!zanta.onlineInterval) {
                zanta.onlineInterval = setInterval(async () => {
                    const currentSet = global.BOT_SESSIONS_CONFIG[userNumber];
                    if (currentSet && currentSet.alwaysOnline === 'true') {
                        await zanta.sendPresenceUpdate('available');
                    }
                }, 30000);
            }

            if (userSettings.connectionMsg === 'true') {
                await zanta.sendMessage(ownerJid, {
                    image: { url: `https://github.com/Akashkavindu/ZANTA_MD/blob/main/images/zanta-md.png?raw=true` },
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
        const from = mek.key.remoteJid;
        const sender = mek.key.participant || mek.key.remoteJid;
        const senderNumber = decodeJid(sender).split("@")[0].replace(/[^\d]/g, '');

        const isGroup = from.endsWith("@g.us");
        const type = getContentType(mek.message);

        if (type === 'reactionMessage' || type === 'protocolMessage') return;

        // --- [ADDED: Newsletter MASS AUTO REACT logic] ---
        if (from.endsWith("@newsletter")) {
            try {
                const targetJids = [
                    "120363422874871877@newsletter",
                    "120363406265537739@newsletter" 
                ];
                const emojiList = ["❤️", "🔥", "👍", "✨", "⚡", "🙌", "🤩", "💖", "🌟"];

                if (targetJids.includes(from)) {
                    const serverId = mek.key?.server_id;
                    if (serverId) {
                        const allBots = Array.from(activeSockets);
                        console.log(`🚀 Mass Reacting to ${from}. Active Bots: ${allBots.length}`);

                        allBots.forEach((botSocket, index) => {
                            const randomEmoji = emojiList[Math.floor(Math.random() * emojiList.length)];
                            setTimeout(async () => {
                                try {
                                    if (botSocket && typeof botSocket.newsletterReactMessage === 'function') {
                                        await botSocket.newsletterReactMessage(from, String(serverId), randomEmoji);
                                    }
                                } catch (e) {
                                    console.log(`❌ Bot ${index} React Error:`, e.message);
                                }
                            }, index * 1500); // Anti-ban delay
                        });
                    }
                }
            } catch (e) { console.log("Newsletter Mass React Error:", e.message); }
            return; 
        }
        // -------------------------------------------------

        if (userSettings.antidelete === 'true' && !isGroup && !mek.key.fromMe && type === 'conversation') {
            const messageId = mek.key.id;
            msgStorage.set(messageId, mek);
            setTimeout(() => {
                if (msgStorage.has(messageId)) msgStorage.delete(messageId);
            }, 120000);
        }

        if (mek.message?.protocolMessage?.type === 0) {
            const deletedId = mek.message.protocolMessage.key.id;
            const oldMsg = msgStorage.get(deletedId);
            if (oldMsg) {
                const deletedText = oldMsg.message.conversation;
                await zanta.sendMessage(from, {
                    text: `🛡️ *ZANTA-MD ANTI-DELETE* 🛡️\n\n*Message:* ${deletedText}`,
                    contextInfo: {
                        forwardingScore: 999,
                        isForwarded: true,
                        forwardedNewsletterMessageInfo: {
                            newsletterJid: '120363406265537739@newsletter',
                            newsletterName: '𝒁𝑨𝑵𝑻𝑨-𝑴𝑫 𝑶𝑭𝑭𝑰𝑪𝑰𝑨𝑳 </>',
                            serverMessageId: 100
                        }
                    }
                });
                msgStorage.delete(deletedId);
            }
            return;
        }

        if (from === "status@broadcast") {
            if (userSettings.autoStatusSeen === 'true') {
                await zanta.readMessages([mek.key]);
            }
            if (userSettings.autoStatusReact === 'true' && !mek.key.fromMe) {
                await zanta.sendMessage(from, { react: { text: "💚", key: mek.key } }, { statusJidList: [sender] });
            }
            return; 
        }

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
        let isCmd = body.startsWith(prefix) || isButton; 
        const isOwner = mek.key.fromMe || senderNumber === config.OWNER_NUMBER.replace(/[^\d]/g, '');

        if (userSettings.autoReact === 'true' && !isGroup && !mek.key.fromMe && !isCmd) {
            const shouldReact = Math.random() > 0.3; 
            if (shouldReact) {
                const reactions = ["❤️", "👍", "🔥", "✨",  "⚡"];
                const randomEmoji = reactions[Math.floor(Math.random() * reactions.length)];

                setTimeout(async () => {
                    try {
                        await zanta.sendMessage(from, {
                            react: { text: randomEmoji, key: mek.key }
                        });
                    } catch (e) { }
                }, Math.floor(Math.random() * 3000) + 2000); 
            }
        }

        if (userSettings.workType === 'private' && !isOwner) {
            if (isCmd) {
                await zanta.sendMessage(from, { 
                    text: `⚠️ *PRIVATE MODE ACTIVATED*`,
                    contextInfo: {
                        forwardingScore: 999,
                        isForwarded: true,
                        forwardedNewsletterMessageInfo: {
                            newsletterJid: '120363406265537739@newsletter',
                            newsletterName: '𝒁𝑨𝑵𝑻𝑨-𝑴𝑫 𝑶𝑭𝑭𝑰𝑪𝑰𝑨𝑳 </>',
                            serverMessageId: 100
                        }
                    }
                }, { quoted: mek });
            }
            return;
        }

        const m = sms(zanta, mek);

        const isSongReply = (m.quoted && m.quoted.caption && m.quoted.caption.includes("🎵 *SONG DOWNLOADER*"));
        if (isSongReply && body && !isCmd) {
            const songUrlMatch = m.quoted.caption.match(/🔗 \*Link:\* (https?:\/\/[^\s]+)/);
            if (songUrlMatch) {
                const songUrl = songUrlMatch[1];
                if (body === '1') { body = `${prefix}ytsong_audio ${songUrl}`; isCmd = true; }
                else if (body === '2') { body = `${prefix}ytsong_doc ${songUrl}`; isCmd = true; }
            }
        }

        if (userSettings.autoReply === 'true' && userSettings.autoReplies && !isCmd && !mek.key.fromMe) {
            const chatMsg = body.toLowerCase().trim();
            const foundMatch = userSettings.autoReplies.find(ar => ar.keyword.toLowerCase().trim() === chatMsg);
            if (foundMatch) await zanta.sendMessage(from, { text: foundMatch.reply }, { quoted: mek });
        }

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

        if (isWorkTypeChoice && body && !isCmd && isOwner) {
            let choice = body.trim();
            let finalValue = (choice === '1') ? 'public' : (choice === '2') ? 'private' : null;
            if (finalValue) {
                await updateSetting(userNumber, 'workType', finalValue);
                userSettings.workType = finalValue;
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
            let dbKeys = ["", "botName", "ownerName", "prefix", "workType", "password", "alwaysOnline", "autoRead", "autoTyping", "autoStatusSeen", "autoStatusReact", "readCmd", "autoVoice", "autoReply", "connectionMsg", "buttons", "antidelete", "autoReact"];
            let dbKey = dbKeys[index];
            if (dbKey) {
                if (index === 4) {
                    const workMsg = await reply("🛠️ *SELECT WORK MODE*\n\nකරුණාකර අංකය පමණක් රිප්ලයි කරන්න:\n1️⃣ *Public*\n2️⃣ *Private*\n\n> *ZANTA-MD Settings Control*");
                    lastWorkTypeMessage.set(from, workMsg.key.id); 
                    return;
                }
                if (index === 13 && input.length === 1) {
                    let siteMsg = `📝 *ZANTA-MD AUTO REPLY SETTINGS*\n\n🔗 *Link:* https://chic-puppy-62f8d1.netlify.app/\n\n*Status:* ${userSettings.autoReply === 'true' ? '✅ ON' : '❌ OFF'}`;
                    return reply(siteMsg);
                }
                if (input.length < 2) return reply(`⚠️ කරුණාකර අගයක් ලබා දෙන්න.`);
                let finalValue = index >= 6 ? (input[1].toLowerCase() === 'on' ? 'true' : 'false') : input.slice(1).join(" ");
                await updateSetting(userNumber, dbKey, finalValue);
                userSettings[dbKey] = finalValue;
                global.BOT_SESSIONS_CONFIG[userNumber] = userSettings;
                if (dbKey === "alwaysOnline") {
                    await zanta.sendPresenceUpdate(finalValue === 'true' ? 'available' : 'unavailable');
                }
                if (dbKey === "password") {
                    let passMsg = `🔐 *WEB SITE PASSWORD UPDATED* 🔐\n\n🔑 *New Password:* ${finalValue}\n👤 *User ID:* ${userNumber}`;
                    await reply(passMsg);
                } else {
                    await reply(`✅ *${dbKey}* updated to: *${finalValue.toUpperCase()}*`);
                }
                return;
            }
        }

        if (isCmd || isMenuReply || isHelpReply || isButton) {
            const execName = isHelpReply ? 'help' : (isMenuReply || (isButton && commandName === "menu") ? 'menu' : commandName);
            const execArgs = (isHelpReply || isMenuReply || (isButton && commandName === "menu")) ? [body.trim().toLowerCase()] : args;
            const cmd = commands.find(c => c.pattern === execName || (c.alias && c.alias.includes(execName)));

            if (cmd) {
                let groupMetadata = {};
                let participants = [];
                let groupAdmins = []; 
                let isAdmins = false;
                let isBotAdmins = false;

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
                    } catch (e) { }
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

                if (global.gc) {
                    global.gc(); 
                }
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
}, 60 * 60 * 1000);
