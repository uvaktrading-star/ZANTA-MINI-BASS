const { cmd } = require('../command');
const config = require('../config');
const aliveMsg = require('./aliveMsg');

cmd({
    pattern: "alive",
    react: "🤖",
    desc: "Check if the bot is online.",
    category: "main",
    filename: __filename
},
async (zanta, mek, m, { from, reply }) => {
    try {
        // Database එකෙන් එන අලුත්ම settings ලබා ගනී
        const { botName, prefix } = global.CURRENT_BOT_SETTINGS;

        // aliveMsg.js එකෙන් template එක ගෙන placeholders replace කිරීම
        const finalMsg = aliveMsg.getAliveMessage()
            .replace(/{BOT_NAME}/g, botName)
            .replace(/{OWNER_NUMBER}/g, config.OWNER_NUMBER)
            .replace(/{PREFIX}/g, prefix);

        return await zanta.sendMessage(from, {
            image: { url: config.ALIVE_IMG },
            caption: finalMsg
        }, { quoted: mek });

    } catch (e) {
        console.error("[ALIVE ERROR]", e);
        reply(`❌ Error: ${e.message}`);
    }
});
