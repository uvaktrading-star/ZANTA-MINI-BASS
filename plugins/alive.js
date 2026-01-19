const { cmd, commands } = require('../command'); // commands require කරගත්තා logic එකට
const config = require('../config');
const aliveMsg = require('./aliveMsg');
const { sendButtons } = require("gifted-btns");

const CHANNEL_JID = "120363406265537739@newsletter"; 

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

        if (isButtonsOn) {
            // --- 🔵 BUTTONS ON MODE ---
            // 1. Image එක යැවීම
            await zanta.sendMessage(from, { image: { url: config.ALIVE_IMG } }, { quoted: mek });

            // 2. Buttons යැවීම (ID එකෙන් කෙලින්ම command එක trigger කරයි)
            const buttons = [
                { id: prefix + "ping", text: "⚡ PING" },
                { id: prefix + "menu", text: "📜 MENU" },
                { id: prefix + "settings", text: "⚙️ SETTINGS" },
                { id: prefix + "help", text: "📞 HELP" },
            ];

            return await sendButtons(zanta, from, {
                text: finalMsg,
                footer: `© ${botName} - Cyber System`,
                buttons: buttons
            });

        } else {
            // --- 🟢 BUTTONS OFF MODE (With Channel Forwarding) ---
            return await zanta.sendMessage(from, {
                image: { url: config.ALIVE_IMG },
                caption: finalMsg,
                contextInfo: {
                    forwardingScore: 999,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: CHANNEL_JID,
                        serverMessageId: 100,
                        newsletterName: "𝒁𝑨𝑵𝑻𝑨-𝑴𝑫 𝑶𝑭𝑭𝑰𝑪𝑰𝑨𝑳 </>"
                    }
                }
            }, { quoted: mek });
        }

    } catch (e) {
        console.error("[ALIVE ERROR]", e);
        reply(`❌ Error: ${e.message}`);
    }
});
