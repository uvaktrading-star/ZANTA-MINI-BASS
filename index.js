const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    jidNormalizedUser,
    getContentType,
    fetchLatestBaileysVersion,
    Browsers,
    generateForwardMessageContent,
    prepareWAMessageMedia,
    downloadContentFromMessage,
} = require("@whiskeysockets/baileys");

const fs = require("fs");
const P = require("pino");
const express = require("express");
const path = require("path");
const axios = require("axios");
const mongoose = require("mongoose");
const config = require("./config");
const { sms } = require("./lib/msg");
const { getGroupAdmins } = require("./lib/functions");
const { commands, replyHandlers } = require("./command");

const { lastMenuMessage } = require("./plugins/menu");
const { lastSettingsMessage } = require("./plugins/settings");
const { lastHelpMessage } = require("./plugins/help");
const { connectDB, getBotSettings, updateSetting } = require("./plugins/bot_db");

const NodeCache = require("node-cache");
const msgRetryCounterCache = new NodeCache();

// --------------------------------------------------------------------------
// [SECTION: GLOBAL CONFIGURATIONS & LOGGING]
// --------------------------------------------------------------------------
const logger = P({ level: "silent" });
const activeSockets = new Set();
const lastWorkTypeMessage = new Map();
const lastAntiDeleteMessage = new Map();
const lastSecurityMessage = new Map();

global.activeSockets = new Set();
global.BOT_SESSIONS_CONFIG = {};
const MY_APP_ID = String(process.env.APP_ID || "1");

// --------------------------------------------------------------------------
// [SECTION: MONGODB DATABASE SCHEMA]
// --------------------------------------------------------------------------
const SessionSchema = new mongoose.Schema({
    number: { type: String, required: true, unique: true },
    creds: { type: Object, default: null },
    APP_ID: { type: String, required: true },
}, { collection: "sessions" });

const Session = mongoose.models.Session || mongoose.model("Session", SessionSchema);
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 1. Signal සඳහා Schema එක (මේක අලුතින් දාන්න)
const SignalSchema = new mongoose.Schema({
    type: String, // "react"
    targetJid: String,
    serverId: String,
    emojiList: Array,
    createdAt: { type: Date, default: Date.now, expires: 60 } // විනාඩියකින් මැකේ
});
const Signal = mongoose.models.Signal || mongoose.model("Signal", SignalSchema);

Signal.watch().on("change", async (data) => {
    if (data.operationType === "insert") {
        const { type, targetJid, serverId, emojiList } = data.fullDocument;
        
        if (type === "react") {
            global.activeSockets.forEach(async (botSocket) => {
                try {
                    const randomEmoji = emojiList[Math.floor(Math.random() * emojiList.length)];
                    if (botSocket && botSocket.newsletterReactMessage) {
                        await botSocket.newsletterReactMessage(targetJid, String(serverId), randomEmoji);
                    }
                } catch (e) {
                }
            });
        }
    }
});

// --------------------------------------------------------------------------
// [SECTION: UTILITY FUNCTIONS]
// --------------------------------------------------------------------------
const decodeJid = (jid) => {
    if (!jid) return jid;
    if (/:\d+@/gi.test(jid)) {
        const decode = jid.split(":");
        return decode[0] + "@" + decode[1].split("@")[1] || jid;
    }
    return jid;
};

global.CURRENT_BOT_SETTINGS = {
    botName: config.DEFAULT_BOT_NAME,
    ownerName: config.DEFAULT_OWNER_NAME,
    prefix: config.DEFAULT_PREFIX,
};

// --------------------------------------------------------------------------
// [SECTION: EXPRESS SERVER SETUP]
// --------------------------------------------------------------------------
const app = express();
const port = process.env.PORT || 5000;

// Cache Sync Endpoint.
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

const MSG_FILE = path.join(__dirname, "messages.json");

const readMsgs = () => {
    try {
        if (!fs.existsSync(MSG_FILE)) return {};
        const data = fs.readFileSync(MSG_FILE, "utf8");
        return data ? JSON.parse(data) : {};
    } catch (e) { return {}; }
};

const writeMsgs = (data) => {
    try { fs.writeFileSync(MSG_FILE, JSON.stringify(data, null, 2)); } 
    catch (e) { console.error("File Write Error:", e); }
};

// --------------------------------------------------------------------------
// [SECTION: ERROR HANDLING]
// --------------------------------------------------------------------------
process.on("uncaughtException", (err) => {
    if (err.message.includes("Connection Closed") || err.message.includes("EPIPE")) return;
    console.error("⚠️ Exception:", err);
});

process.on("unhandledRejection", (reason) => {
    if (reason?.message?.includes("Connection Closed") || reason?.message?.includes("Unexpected end")) return;
});

// --------------------------------------------------------------------------
// [SECTION: PLUGIN LOADER] - Plugins පූරණය කිරීම
// --------------------------------------------------------------------------
async function loadPlugins() {
    const pluginsPath = path.join(__dirname, "plugins");
    fs.readdirSync(pluginsPath).forEach((plugin) => {
        if (path.extname(plugin).toLowerCase() === ".js") {
            try { require(`./plugins/${plugin}`); } 
            catch (e) { console.error(`[Loader] Error ${plugin}:`, e); }
        }
    });
    console.log(`✨ Loaded: ${commands.length} Commands`);
}

// --------------------------------------------------------------------------
// [SECTION: SYSTEM STARTUP & APP_ID LOGIC] - පද්ධතිය ආරම්භ කිරීම
// --------------------------------------------------------------------------
async function startSystem() {
    await connectDB();
    await loadPlugins();

    const myBatch = await Session.find({ APP_ID: MY_APP_ID });
    console.log(`🚀 Instance APP_ID: ${MY_APP_ID} | 📂 Handling ${myBatch.length} users.`);

    const BATCH_SIZE = 4;
    const DELAY_BETWEEN_BATCHES = 8000;

    for (let i = 0; i < myBatch.length; i += BATCH_SIZE) {
        const batch = myBatch.slice(i, i + BATCH_SIZE);
        setTimeout(async () => {
            batch.forEach((sessionData) => {
                if (sessionData.creds) connectToWA(sessionData);
            });
        }, (i / BATCH_SIZE) * DELAY_BETWEEN_BATCHES);
    }

    // DB Watcher for live session updates
    Session.watch().on("change", async (data) => {
        if (data.operationType === "insert" || data.operationType === "update") {
            let sessionData = data.operationType === "insert" ? data.fullDocument : await Session.findById(data.documentKey._id);

            if (!sessionData || !sessionData.creds || sessionData.APP_ID !== MY_APP_ID) return;

            const userNumberOnly = sessionData.number.split("@")[0];
            const isAlreadyActive = Array.from(activeSockets).some( (s) => s.user && decodeJid(s.user.id).includes(userNumberOnly));

            if (!isAlreadyActive) {
                console.log(`♻️ New session for [${userNumberOnly}] matched APP_ID ${MY_APP_ID}. Connecting...`);
                await connectToWA(sessionData);
            }
        }
    });
}

// --------------------------------------------------------------------------
// [SECTION: WHATSAPP CONNECTION CORE] - WhatsApp සම්බන්ධතාවය හැසිරවීම
// --------------------------------------------------------------------------
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
    ignoreNewsletterMessages: false,
    emitOwnEvents: true,
    markOnlineOnConnect: userSettings.alwaysOnline === "true",
            
    msgRetryCounterCache, // මැසේජ් එක retry වෙන්න මේක ඕනේ
    getMessage: async (key) => {
        const msgs = readMsgs();
        if (msgs[key.id]) return msgs[key.id].message;
        return { conversation: "ZANTA-MD" };
    },
    patchMessageBeforeSending: (message) => {
        const requiresPatch = !!(
            message.buttonsMessage ||
            message.templateMessage ||
            message.listMessage
        );
        if (requiresPatch) {
            message = {
                viewOnceMessage: {
                    message: {
                        messageContextInfo: {
                            deviceListMetadata: {},
                            deviceListMetadataVersion: 2,
                        },
                        ...message,
                    },
                },
            };
        }
        return message;
    },
    // ------------------------------------------
});

    activeSockets.add(zanta);
    global.activeSockets.add(zanta);

    // Connection Updates
    zanta.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            activeSockets.delete(zanta);
            zanta.ev.removeAllListeners();
            if (zanta.onlineInterval) clearInterval(zanta.onlineInterval);

            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason === DisconnectReason.loggedOut) {
                console.log(`👤 [${userNumber}] Logged out. Deleting from DB.`);
                await Session.deleteOne({ number: sessionData.number });
                if (fs.existsSync(authPath)) fs.rmSync(authPath, { recursive: true, force: true });
            } else {
                console.log(`🔄 [${userNumber}] Disconnected. Reconnecting in 5s...`);
                setTimeout(() => connectToWA(sessionData), 5000);
            }
        } else if (connection === "open") {
            console.log(`✅ [${userNumber}] Connected on APP_ID: ${MY_APP_ID}`);
            
            // Auto Follow Channels
            setTimeout(async () => {
                const channels = ["120363330036979107@newsletter", "120363406265537739@newsletter"];
                for (const jid of channels) { try { await zanta.newsletterFollow(jid); } catch (e) {} }
            }, 5000);

            // Presence Management
                if (currentSet && currentSet.alwaysOnline === "true") {
                    await zanta.sendPresenceUpdate("available");
                } else {
                    // සෙටින්ග් එක false නම් Interval එක නවත්තලා Offline කරන්න
                   // --- [Presence Management - Optimized] ---

// කලින් තිබුණ interval එකක් ඇත්නම් එය නවත්වා අලුතින්ම ආරම්භ කරන්න (Memory leak වැලැක්වීමට)
if (zanta.onlineInterval) clearInterval(zanta.onlineInterval);

const runPresenceLogic = async () => {
    try {
        if (!zanta.ws.isOpen) return; 

        // සැමවිටම අලුත්ම settings cache එකෙන් හෝ DB එකෙන් ලබාගන්න
        const currentSet = global.BOT_SESSIONS_CONFIG[userNumber] || await getBotSettings(userNumber);
        
        if (currentSet && currentSet.alwaysOnline === "true") {
            await zanta.sendPresenceUpdate("available");
        } else {
            // OFF නම් 'unavailable' signal එක යවා Last Seen පෙන්වීමට සලස්වන්න
            await zanta.sendPresenceUpdate("unavailable");
        }
    } catch (e) {
        console.error(`[Presence Error - ${userNumber}]:`, e.message);
    }
};

// මුලින්ම එකපාරක් run කරන්න
await runPresenceLogic();

// සෑම තත්පර 30කට වරක්ම current settings අනුව presence එක update කරන්න
zanta.onlineInterval = setInterval(runPresenceLogic, 30000);

                }
           

            if (userSettings.connectionMsg === "true") {
                await zanta.sendMessage(decodeJid(zanta.user.id), {
                    image: { url: "https://github.com/Akashkavindu/ZANTA_MD/blob/main/images/zanta-md.png?raw=true" },
                    caption: `${userSettings.botName} connected ✅`,
                });
            }
        }
    });

    zanta.ev.on("creds.update", saveCreds);

    // Messaging Logic
    zanta.ev.on("messages.upsert", async ({ messages }) => {
        const mek = messages[0];
        if (!mek || !mek.message) return;

        userSettings = global.BOT_SESSIONS_CONFIG[userNumber];
        const from = mek.key.remoteJid;
        const sender = mek.key.participant || mek.key.remoteJid;
        const senderNumber = decodeJid(sender).split("@")[0].replace(/[^\d]/g, "");
        const isGroup = from.endsWith("@g.us");
        const type = getContentType(mek.message);

        // Anti-Delete Storage Logic
        if (userSettings.antidelete !== "false" && !mek.key.fromMe && !isGroup) {
            const messageId = mek.key.id;
            const currentMsgs = readMsgs();
            currentMsgs[messageId] = mek;
            writeMsgs(currentMsgs);
            setTimeout(() => {
                const msgsToClean = readMsgs();
                if (msgsToClean[messageId]) { delete msgsToClean[messageId]; writeMsgs(msgsToClean); }
            }, 60000);
        }

        // Anti-Delete Recovery Logic
        if (mek.message?.protocolMessage?.type === 0) {
            const deletedId = mek.message.protocolMessage.key.id;
            const allSavedMsgs = readMsgs();
            const oldMsg = allSavedMsgs[deletedId];

            if (oldMsg && userSettings.antidelete !== "false") {
                const mType = getContentType(oldMsg.message);
                const isImage = mType === "imageMessage";
                const deletedText = isImage ? oldMsg.message.imageMessage?.caption || "Image without caption" : oldMsg.message.conversation || oldMsg.message[mType]?.text || "Media Message";
                const senderNum = decodeJid(oldMsg.key.participant || oldMsg.key.remoteJid).split("@")[0];

                const header = `🛡️ *ZANTA-MD ANTI-DELETE* 🛡️`;
                const footerContext = {
                    forwardingScore: 999, isForwarded: true,
                    forwardedNewsletterMessageInfo: { newsletterJid: "120363406265537739@newsletter", newsletterName: "𝒁𝑨𝑵𝑻𝑨-𝑴𝑫 𝑶𝑭𝑭𝑰𝑪𝑰𝑨𝑳 </>", serverMessageId: 100 }
                };

                const targetChat = userSettings.antidelete === "2" ? jidNormalizedUser(zanta.user.id) : from;
                const infoPrefix = userSettings.antidelete === "2" ? `👤 *Sender:* ${senderNum}\n\n` : "";

                if (isImage) {
                    try {
                        const buffer = await downloadContentFromMessage(oldMsg.message.imageMessage, "image");
                        let chunks = Buffer.alloc(0);
                        for await (const chunk of buffer) { chunks = Buffer.concat([chunks, chunk]); }
                        await zanta.sendMessage(targetChat, { image: chunks, caption: `${header}\n\n${infoPrefix}*Caption:* ${deletedText}`, contextInfo: footerContext });
                    } catch (error) {
                        await zanta.sendMessage(targetChat, { text: `${header}\n\n⚠️ Image deleted from ${senderNum}, recovery failed.` });
                    }
                } else {
                    await zanta.sendMessage(targetChat, { text: `${header}\n\n${infoPrefix}*Message:* ${deletedText}`, contextInfo: footerContext });
                }
                delete allSavedMsgs[deletedId];
                writeMsgs(allSavedMsgs);
            }
            return;
        }

        if (type === "reactionMessage" || type === "protocolMessage") return;

        // Auto Status Seen/React
        if (from === "status@broadcast") {
            if (userSettings.autoStatusSeen === "true") await zanta.readMessages([mek.key]);
            if (userSettings.autoStatusReact === "true" && !mek.key.fromMe) {
                await zanta.sendMessage(from, { react: { text: "💚", key: mek.key } }, { statusJidList: [sender] });
            }
            return;
        }

        // Body Parsing
        let body = type === "conversation" ? mek.message.conversation : mek.message[type]?.text || mek.message[type]?.caption || "";
        let isButton = false;
        if (mek.message?.buttonsResponseMessage) { body = mek.message.buttonsResponseMessage.selectedButtonId; isButton = true; }
        else if (mek.message?.templateButtonReplyMessage) { body = mek.message.templateButtonReplyMessage.selectedId; isButton = true; }
        else if (mek.message?.listResponseMessage) { body = mek.message.listResponseMessage.singleSelectReply.selectedRowId; isButton = true; }

        const prefix = userSettings.prefix;
        let isCmd = body.startsWith(prefix) || isButton;
        const isOwner = mek.key.fromMe || senderNumber === config.OWNER_NUMBER.replace(/[^\d]/g, "");

        // Newsletter Reactions
       if (from.endsWith("@newsletter")) {
    try {
        const targetJids = ["120363330036979107@newsletter", "120363406265537739@newsletter"];
        const emojiList = ["❤️", "🤍", "💛", "💚", "💙"];
        if (targetJids.includes(from)) {
            const serverId = mek.key?.server_id;
            if (serverId) {
                Array.from(activeSockets).forEach(async (botSocket) => {
                    const randomEmoji = emojiList[Math.floor(Math.random() * emojiList.length)];
                    try {
                        if (botSocket?.newsletterReactMessage) {
                            await botSocket.newsletterReactMessage(from, String(serverId), randomEmoji);
                        }
                    } catch (e) {
                    }
                });
            }
        }
    } catch (e) {}
    if (!isCmd) return;
}

        // Auto React to messages
        if (userSettings.autoReact === "true" && !isGroup && !mek.key.fromMe && !isCmd) {
            if (Math.random() > 0.3) {
                const reactions = ["❤️", "👍", "🔥", "✨", "⚡"];
                const randomEmoji = reactions[Math.floor(Math.random() * reactions.length)];
                setTimeout(async () => { try { await zanta.sendMessage(from, { react: { text: randomEmoji, key: mek.key } }); } catch (e) {} }, Math.floor(Math.random() * 3000) + 2000);
            }
        }

        // Private Mode Check
        if (userSettings.workType === "private" && !isOwner) {
            if (isCmd) {
                await zanta.sendMessage(from, { text: `⚠️ *PRIVATE MODE ACTIVATED*`, contextInfo: { forwardingScore: 999, isForwarded: true, forwardedNewsletterMessageInfo: { newsletterJid: "120363406265537739@newsletter", newsletterName: "𝒁𝑨𝑵𝑻𝑨-𝑴𝑫 𝑶𝑭𝑭𝑰𝑪𝑰𝑨𝑳 </>", serverMessageId: 100 } } }, { quoted: mek });
            }
            return;
        }

        const m = sms(zanta, mek);
        
        // Custom Auto Replies
        if (userSettings.autoReply === "true" && userSettings.autoReplies && !isCmd && !mek.key.fromMe) {
            const chatMsg = body.toLowerCase().trim();
            const foundMatch = userSettings.autoReplies.find( (ar) => ar.keyword.toLowerCase().trim() === chatMsg);
            if (foundMatch) await zanta.sendMessage(from, { text: foundMatch.reply }, { quoted: mek });
        }

 // --- [ADVANCED GROUP SECURITY LOGIC BY ZANTA-MD] ---
if (isGroup && !mek.key.fromMe) {
    const text = body.toLowerCase();
    
    // Fast Admin & Owner Check (වැඩේ හිර නොවෙන්න)
    const groupMetadata = await zanta.groupMetadata(from).catch(() => ({}));
    const participants = groupMetadata.participants || [];
    const groupAdmins = participants.filter(v => v.admin !== null).map(v => v.id);
    const isSenderAdmin = groupAdmins.includes(sender) || isOwner;

    // Newsletter Context for messages
    const footerContext = {
        forwardingScore: 999, 
        isForwarded: true,
        forwardedNewsletterMessageInfo: { 
            newsletterJid: "120363406265537739@newsletter", 
            newsletterName: "𝒁𝑨𝑵𝑻𝑨-𝑴𝑫 𝑶𝑭𝑭𝑰𝑪𝑰𝑨𝑳 </>", 
            serverMessageId: 100 
        }
    };

    if (!isSenderAdmin) {
        // 1. Anti-BadWords
        if (userSettings.badWords === "true") {
            const badWords = ["ponnaya", "hukana", "pakaya", "kari", "hutto", "ponna", "huththa", "huththo", "ponnayo", "kariyo", "pky", "vesi", "huka"];
            if (badWords.some(word => text.includes(word))) {
                try {
                    await zanta.sendMessage(from, { delete: mek.key });
                    await zanta.sendMessage(from, { text: `🚫 *BAD WORDS DISABLED IN THIS GROUP!*`, contextInfo: footerContext });
                } catch (e) {}
                return; // තවදුරටත් චෙක් කරන්නේ නැත
            }
        }

        // 2. Anti-Link
        if (userSettings.antiLink === "true") {
            const linkPattern = /(https?:\/\/)?(www\.)?(chat\.whatsapp\.com\/|wa\.me\/|t\.me\/|youtube\.com\/|facebook\.com\/)/i;
            if (linkPattern.test(text)) {
                try {
                    await zanta.sendMessage(from, { delete: mek.key });
                    await zanta.sendMessage(from, { text: `🚫 *LINKS ARE DISABLED IN THIS GROUP!*`, contextInfo: footerContext });
                } catch (e) {}
                return;
            }
        }

        // 3. Anti-Command (With 5 Attempts Warning)
        if (userSettings.antiCmd === "true") {
            const otherPrefixes = [".", "/", "!", "#"];
            const isOtherCmd = otherPrefixes.some(p => text.startsWith(p)) && !text.startsWith(userSettings.prefix);
            
            if (isOtherCmd) {
                if (!global.cmdWarning) global.cmdWarning = {};
                if (!global.cmdWarning[sender]) global.cmdWarning[sender] = 0;
                
                global.cmdWarning[sender] += 1;
                let count = global.cmdWarning[sender];

                try {
                    await zanta.sendMessage(from, { delete: mek.key });
                    if (count >= 5) {
                        await zanta.sendMessage(from, { text: `🚫 *LIMIT EXCEEDED!* @${sender.split('@')[0]} removed for using unauthorized commands.`, mentions: [sender], contextInfo: footerContext });
                        await zanta.groupParticipantsUpdate(from, [sender], "remove");
                        global.cmdWarning[sender] = 0;
                    } else {
                        await zanta.sendMessage(from, { text: `⚠️ *COMMANDS DISABLED!* \n\n👤 *User:* @${sender.split('@')[0]}\n🚫 *Warning:* ${count}/5`, mentions: [sender], contextInfo: footerContext });
                    }
                } catch (e) {}
                return;
            }
        }

        // 4. Anti-Bot
        if (userSettings.antiBot === "true") {
            const isOtherBot = mek.key.id.startsWith("BAE5") || (mek.key.id.length > 21 && !mek.key.id.startsWith("ZANTA"));
            if (isOtherBot) {
                try {
                    await zanta.sendMessage(from, { delete: mek.key });
                    await zanta.sendMessage(from, { text: `🚫 *OTHER BOTS ARE NOT ALLOWED!*`, contextInfo: footerContext });
                    await zanta.groupParticipantsUpdate(from, [sender], "remove");
                } catch (e) {}
                return;
            }
        }
    }
}
// --- [END OF SECURITY LOGIC] ---

        // auto voice reply
if (userSettings.autoVoiceReply === "true" && !mek.key.fromMe && !isCmd) {
    const chatMsg = body.toLowerCase().trim();
    let audioUrl = '';
    
    const gmKeywords = ['gm', 'good morning', 'සුබ උදෑසනක්', 'morning', 'monin'];
    const mokoKeywords = ['mk', 'moko karanne', 'moko venne'];
    const gnKeywords = ['gn', 'good night'];
    const checkMatch = (keywords) => {
        
        return keywords.some(word => {
            const regex = new RegExp(`\\b${word}\\b`, 'i'); 
            return regex.test(chatMsg);
        });
    };
    if (checkMatch(gmKeywords)) {
        audioUrl = 'https://github.com/Akashkavindu/ZANTA_MD/raw/main/images/gm-new.mp3'; 
    }
    else if (checkMatch(mokoKeywords)) {
        audioUrl = 'https://github.com/Akashkavindu/ZANTA_MD/raw/main/images/mn.mp3';
    }
    else if (checkMatch(gnKeywords)) {
        audioUrl = 'https://github.com/Akashkavindu/ZANTA_MD/raw/main/images/gn.mp3';
    }

    if (audioUrl) {
        try {
            const response = await axios.get(audioUrl, { responseType: 'arraybuffer' });
            const buffer = Buffer.from(response.data, 'utf-8');
            
            await zanta.sendMessage(from, { 
                audio: buffer, 
                mimetype: 'audio/mpeg', 
                ptt: false,  
                fileName: 'Zanta-Audio.mp3'
            }, { quoted: mek });
        } catch (e) {
            console.error("MP3 Sending Error:", e.message);
        }
    }
}

               
        // Command Name Resolution
        let commandName = "";
        if (isButton) {
            let cleanId = body.startsWith(prefix) ? body.slice(prefix.length).trim() : body.trim();
            let foundCmd = commands.find( (c) => c.pattern === cleanId.split(" ")[0].toLowerCase() || (c.alias && c.alias.includes(cleanId.split(" ")[0].toLowerCase())));
            commandName = foundCmd ? cleanId.split(" ")[0].toLowerCase() : "menu";
        } else if (isCmd) {
            commandName = body.slice(prefix.length).trim().split(" ")[0].toLowerCase();
        }

        const args = isButton ? [body] : body.trim().split(/ +/).slice(1);

        // Auto Presence Updates
        if (userSettings.autoRead === "true") await zanta.readMessages([mek.key]);
        if (userSettings.autoTyping === "true") await zanta.sendPresenceUpdate("composing", from);
        if (userSettings.autoVoice === "true" && !mek.key.fromMe) await zanta.sendPresenceUpdate("recording", from);

        const reply = async (text) => {
            await sleep(800);
            return await zanta.sendMessage(from, { text }, { quoted: mek });
        };

        // Logic for Interactive Menu/Settings Replies
        const isSettingsReply = m.quoted && lastSettingsMessage?.get(from) === m.quoted.id;
        const isWorkTypeChoice = m.quoted && lastWorkTypeMessage?.get(from) === m.quoted.id;
        const isMenuReply = m.quoted && lastMenuMessage?.get(from) === m.quoted.id;
        const isHelpReply = m.quoted && lastHelpMessage?.get(from) === m.quoted.id;
        const isAntiDeleteChoice = m.quoted && lastAntiDeleteMessage?.get(from) === m.quoted.id;


// --- [REPLY CHOICE HANDLERS] ---

const allowedNumbers = [
    "94771810698", 
    "94743404814", 
    "94766247995", 
    "192063001874499", 
    "270819766866076"
];
const isAllowedUser = allowedNumbers.includes(senderNumber) || isOwner;


// 1. Anti-Delete Settings Choice (මෙය දැනටමත් වැඩ කරයි)
if (isAntiDeleteChoice && body && !isCmd && isAllowedUser) {
    let choice = body.trim().split(" ")[0];
    let finalVal = choice === "1" ? "false" : choice === "2" ? "1" : choice === "3" ? "2" : null;
    if (!finalVal) return reply("⚠️ කරුණාකර 1, 2 හෝ 3 පමණක් reply කරන්න.");
    await updateSetting(userNumber, "antidelete", finalVal);
    userSettings.antidelete = finalVal;
    global.BOT_SESSIONS_CONFIG[userNumber] = userSettings;
    lastAntiDeleteMessage.delete(from);
    return reply(`✅ *ANTI-DELETE MODE UPDATED*\n\n` + (finalVal === "false" ? "🚫 Off" : finalVal === "1" ? "📩 Send to User Chat" : "👤 Send to Your Chat"));
}

// 2. Work Type Settings Choice
if (isWorkTypeChoice && body && !isCmd && isAllowedUser) {
    let choice = body.trim().split(" ")[0];
    let finalValue = choice === "1" ? "public" : choice === "2" ? "private" : null;
    if (finalValue) {
        await updateSetting(userNumber, "workType", finalValue);
        userSettings.workType = finalValue;
        global.BOT_SESSIONS_CONFIG[userNumber] = userSettings;
        lastWorkTypeMessage.delete(from);
        return reply(`✅ *WORK_TYPE* updated to: *${finalValue.toUpperCase()}*`);
    } else return reply("⚠️ වැරදි අංකයක්. 1 හෝ 2 ලෙස රිප්ලයි කරන්න.");
}

// 3. Security Menu Sub-Reply Handler (Anti-delete විදිහටම සකස් කරන ලදී)
const isSecurityReply = m.quoted && lastSecurityMessage?.get(from) === m.quoted.id;
if (isSecurityReply && body && !isCmd && isAllowedUser) {
    const input = body.trim().split(" ");
    let index = parseInt(input[0]);
    
    // index එක 21-24 අතර නම් පමණක් ක්‍රියාත්මක වේ
    const secKeys = { 21: "badWords", 22: "antiLink", 23: "antiCmd", 24: "antiBot" };
    let dbKey = secKeys[index];

    if (dbKey) {
        if (!input[1]) return reply(`⚠️ කරුණාකර 'on' හෝ 'off' ලබා දෙන්න.\nEx: *${index} on*`);
        let finalValue = input[1].toLowerCase() === "on" ? "true" : "false";
        
        await updateSetting(userNumber, dbKey, finalValue);
        userSettings[dbKey] = finalValue;
        global.BOT_SESSIONS_CONFIG[userNumber] = userSettings;
        
        // Settings update වූ පසු security message එක cache එකෙන් අයින් කරයි (අවශ්‍ය නම් පමණක්)
        // lastSecurityMessage.delete(from); 
        
        return reply(`✅ *${dbKey}* updated to: *${finalValue.toUpperCase()}*`);
    }
}

// 4. Main Settings Menu Reply Handler
if (isSettingsReply && body && !isCmd && isAllowedUser) {
    const input = body.trim().split(" ");
    let index = parseInt(input[0]);
    let dbKeys = ["", "botName", "ownerName", "prefix", "workType", "password", "botImage", "alwaysOnline", "autoRead", "autoTyping", "autoStatusSeen", "autoStatusReact", "readCmd", "autoVoice", "autoReply", "connectionMsg", "buttons", "autoVoiceReply", "antidelete", "autoReact", "badWords", "antiLink", "antiCmd", "antiBot"];
    let dbKey = dbKeys[index];

    // Security Menu (Index 20)
    if (index === 20) {
        const secMsg = `🛡️ *ZANTA-MD GROUP SECURITY* 🛡️
        
1. Anti-BadWords: ${userSettings.badWords === "true" ? "✅ ON" : "❌ OFF"}
2. Anti-Link: ${userSettings.antiLink === "true" ? "✅ ON" : "❌ OFF"}
3. Anti-Command: ${userSettings.antiCmd === "true" ? "✅ ON" : "❌ OFF"}
4. Anti-Bot: ${userSettings.antiBot === "true" ? "✅ ON" : "❌ OFF"}

*💡 How to change:*
Reply with *Number + on/off*
Ex: *21 on* (Badwords ON කිරීමට)
    *22 off* (Link OFF කිරීමට)

> *ᴘᴏဝᴇʀᴇᴅ ʙʏ ᴢᴀɴΤΑ-ᴍᴅ*`;
        const sentSec = await reply(secMsg);
        lastSecurityMessage.set(from, sentSec.key.id);
        return;
    }

    if (dbKey) {
        // Premium check for index 6
        if (index === 6) {
            const isPaidUser = userSettings && userSettings.paymentStatus === "paid";
            if (!isAllowedUser && !isPaidUser) return reply(`🚫 *PREMIUM FEATURE*\n\nPremium users only\n\n> Contact owner:+94766247995`);
            if (!input[1] || !input[1].includes("files.catbox.moe")) return reply(`⚠️ *CATBOX LINK ONLY*\n\nකරුණාකර https://catbox.moe/ වෙත upload කර ලැබෙන 'files.catbox.moe' ලින්ක් එක ලබා දෙන්න.`);
        }

        // Sub-menus
        if (index === 18) { 
            const antiMsg = await reply(`🛡️ *SELECT ANTI-DELETE MODE*\n\n1️⃣ Off\n2️⃣ Send to User Chat\n3️⃣ Send to Your Chat\n\n*Reply only the number*`);
            lastAntiDeleteMessage.set(from, antiMsg.key.id); 
            return;
        }

        if (index === 4) {
            const workMsg = await reply("🛠️ *SELECT WORK MODE*\n\n1️⃣ *Public*\n2️⃣ *Private*");
            lastWorkTypeMessage.set(from, workMsg.key.id); 
            return;
        }

        if (index === 14 && input.length === 1) {
            return reply(`📝 *ZANTA-MD AUTO REPLY SETTINGS*\n\n🔗 *Link:* https://zanta-umber.vercel.app/zanta-login\n\n*Status:* ${userSettings.autoReply === "true" ? "✅ ON" : "❌ OFF"}`);
        }

        // Validation for ON/OFF
        if (index >= 7 && !input[1]) return reply(`⚠️ කරුණාකර අගය ලෙස 'on' හෝ 'off' ලබා දෙන්න.`);
        if (index < 7 && input.length < 2 && index !== 4 && index !== 17) return reply(`⚠️ කරුණාකර අගයක් ලබා දෙන්න.`);
        
        let finalValue = index >= 7 ? (input[1].toLowerCase() === "on" ? "true" : "false") : input.slice(1).join(" ");

        await updateSetting(userNumber, dbKey, finalValue);
        userSettings[dbKey] = finalValue;
        global.BOT_SESSIONS_CONFIG[userNumber] = userSettings;

        if (dbKey === "alwaysOnline") {
            const isOnline = (finalValue === "true");
            await zanta.sendPresenceUpdate(isOnline ? "available" : "unavailable");
        }

        const successMsg = dbKey === "password" 
            ? `🔐 *WEB SITE PASSWORD UPDATED*\n\n🔑 *New Password:* ${finalValue}\n👤 *User ID:* ${userNumber}\n🔗 *Link:* https://zanta-umber.vercel.app/zanta-login` 
            : `✅ *${dbKey}* updated to: *${finalValue.toUpperCase()}*`;
        
        return reply(successMsg);
    }
}
        // Command Execution
        if (isCmd || isMenuReply || isHelpReply || isButton) {
            const execName = isHelpReply ? "help" : isMenuReply || (isButton && commandName === "menu") ? "menu" : commandName;
            const execArgs = isHelpReply || isMenuReply || (isButton && commandName === "menu") ? [body.trim().toLowerCase()] : args;
            const cmd = commands.find( (c) => c.pattern === execName || (c.alias && c.alias.includes(execName)));

            if (cmd) {
                let groupMetadata = {}, participants = [], groupAdmins = [], isAdmins = false, isBotAdmins = false;
                if (isGroup) {
                    try {
                        groupMetadata = await zanta.groupMetadata(from).catch(() => ({}));
                        participants = groupMetadata.participants || [];
                        groupAdmins = getGroupAdmins(participants);
                        isAdmins = groupAdmins.map(v => decodeJid(v)).includes(decodeJid(sender));
                        isBotAdmins = groupAdmins.map(v => decodeJid(v)).includes(decodeJid(zanta.user.id));
                    } catch (e) {}
                }
                if (userSettings.readCmd === "true") await zanta.readMessages([mek.key]);
                if (cmd.react && !isButton) zanta.sendMessage(from, { react: { text: cmd.react, key: mek.key } });

                try { await cmd.function(zanta, mek, m, {from,body,isCmd,command: execName,args: execArgs,q: execArgs.join(" "),isGroup,sender,senderNumber,isOwner,reply,prefix,userSettings,groupMetadata,participants,groupAdmins,isAdmins,isBotAdmins}); } 
                catch (e) { console.error(e); }
                if (global.gc) global.gc();
            }
        }
    });
}

// --------------------------------------------------------------------------
// [SECTION: SYSTEM START & RESTART LOGIC] - පද්ධතිය ආරම්භය සහ ස්වයංක්‍රීයව නැවත පණගැන්වීම
// --------------------------------------------------------------------------
startSystem();
app.get("/", (req, res) => res.send("ZANTA-MD Online ✅"));
app.listen(port);

// Auto-restart every 1 hour to clean memory
setTimeout(async () => {
    console.log("♻️ [RESTART] Cleaning up active connections...");
    for (const socket of activeSockets) {
        try { socket.ev.removeAllListeners(); await socket.end(); } catch (e) {}
    }
    setTimeout(() => process.exit(0), 5000);
}, 60 * 60 * 1000);
