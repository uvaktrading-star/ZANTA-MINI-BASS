const { cmd, commands } = require('../command');
const config = require('../config');
const aliveMsg = require('./aliveMsg');
const axios = require('axios'); // පින්තූරය කලින් Download කර ගැනීමට

const CHANNEL_JID = "120363406265537739@newsletter"; 

// --- 🖼️ IMAGE PRE-LOAD LOGIC ---
let cachedAliveImage = null;

async function preLoadAliveImage() {
    try {
        const imageUrl = config.ALIVE_IMG || "https://github.com/Akashkavindu/ZANTA_MD/blob/main/images/Gemini_Generated_Image_4xcl2e4xcl2e4xcl.png?raw=true";
        const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        cachedAliveImage = Buffer.from(response.data);
        console.log("✅ [CACHE] Alive image pre-loaded successfully.");
    } catch (e) {
        console.error("❌ [CACHE] Failed to pre-load alive image:", e.message);
        cachedAliveImage = { url: config.ALIVE_IMG }; // වැරදුනොත් URL එකම පාවිච්චි කරයි
    }
}

// බොට් පණ ගැන්වෙන විටම පින්තූරය ගන්න
preLoadAliveImage();

cmd({
    pattern: "alive",
    react: "🤖",
    desc: "Check if the bot is online.",
    category: "main",
    filename: __filename
},
async (zanta, mek, m, { from, reply, userSettings }) => {
    try {
        const settings = userSettings || global.CURRENT_BOT_SETTINGS || {};
        const botName = settings.botName || config.DEFAULT_BOT_NAME || "ZANTA-MD";
        const prefix = settings.prefix || config.DEFAULT_PREFIX || ".";
        const isButtonsOn = settings.buttons === 'true';

        // Placeholder replace කිරීම
        const finalMsg = aliveMsg.getAliveMessage()
            .replace(/{BOT_NAME}/g, botName)
            .replace(/{OWNER_NUMBER}/g, config.OWNER_NUMBER)
            .replace(/{PREFIX}/g, prefix);

        // පින්තූරය තෝරා ගැනීම (Cache එකෙන් හෝ Config එකෙන්)
        const imageToDisplay = cachedAliveImage || { url: config.ALIVE_IMG };

        if (isButtonsOn) {
            // --- 🔵 BUTTONS ON MODE (Image + Buttons in One Message) ---

            return await zanta.sendMessage(from, {
                image: imageToDisplay, 
                caption: finalMsg,
                footer: `© ${botName} - Cyber System`,
                buttons: [
                    { buttonId: prefix + "ping", buttonText: { displayText: "⚡ PING" }, type: 1 },
                    { buttonId: prefix + "menu", buttonText: { displayText: "📜 MENU" }, type: 1 },
                    { buttonId: prefix + "settings", buttonText: { displayText: "⚙️ SETTINGS" }, type: 1 },
                    { buttonId: prefix + "help", buttonText: { displayText: "📞 HELP" }, type: 1 }
                ],
                headerType: 4, 
                contextInfo: {
                    forwardingScore: 999,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: CHANNEL_JID,
                        serverMessageId: 100,
                        newsletterName: "ZANTA-MD UPDATES"
                    }
                }
            }, { quoted: mek });

        } else {
            // --- 🟢 BUTTONS OFF MODE (Text Only/Normal) ---
            return await zanta.sendMessage(from, {
                image: imageToDisplay,
                caption: finalMsg,
                contextInfo: {
                    forwardingScore: 999,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: CHANNEL_JID,
                        serverMessageId: 100,
                        newsletterName: "ZANTA-MD UPDATES"
                    }
                }
            }, { quoted: mek });
        }

    } catch (e) {
        console.error("[ALIVE ERROR]", e);
        reply(`❌ Error: ${e.message}`);
    }
});
