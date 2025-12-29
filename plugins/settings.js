const { cmd } = require("../command");
const { updateSetting } = require("./bot_db");
const config = require("../config");

const SETTINGS_IMG = "https://github.com/Akashkavindu/ZANTA_MD/blob/main/images/settings.jpg?raw=true";

// Settings Reply එක හඳුනා ගැනීමට (RAM එක බේරීමට පැය 1කින් auto clean වේ)
const lastSettingsMessage = new Map();

cmd({
    pattern: "settings",
    alias: ["set", "dashboard", "status"],
    desc: "Display and edit bot settings via reply.",
    category: "main",
    react: "⚙️",
    filename: __filename,
}, async (zanta, mek, m, { from, reply, isOwner, prefix, userSettings }) => {
    
    if (!isOwner) return reply("⚠️ *මෙම Dashboard එක භාවිතා කළ හැක්කේ බොට් අයිතිකරුට පමණි!*");

    const settings = userSettings || global.CURRENT_BOT_SETTINGS || {};
    const botName = settings.botName || config.DEFAULT_BOT_NAME || "ZANTA-MD";
    const ownerName = settings.ownerName || config.DEFAULT_OWNER_NAME || "Owner";
    const botPrefix = settings.prefix || prefix || ".";

    // --- 📊 Status Indicators ---
    const getStatus = (val) => val === 'true' ? '✅' : '❌';

    let statusText = `╭━━━〔 ${botName.toUpperCase()} 〕━━━┈⊷\n`;
    statusText += `┃\n`;
    statusText += `┃ 1️⃣ *Name:* ${botName}\n`;
    statusText += `┃ 2️⃣ *Owner:* ${ownerName}\n`;
    statusText += `┃ 3️⃣ *Prefix:* [ ${botPrefix} ]\n`;
    statusText += `┃ 4️⃣ *Auto Read:* ${getStatus(settings.autoRead)}\n`;
    statusText += `┃ 5️⃣ *Auto Typing:* ${getStatus(settings.autoTyping)}\n`;
    statusText += `┃ 6️⃣ *Status Seen:* ${getStatus(settings.autoStatusSeen)}\n`;
    statusText += `┃ 7️⃣ *Always Online:* ${getStatus(settings.alwaysOnline)}\n`;
    statusText += `┃ 8️⃣ *Read Cmd:* ${getStatus(settings.readCmd)}\n`;
    statusText += `┃ 9️⃣ *Auto Voice:* ${getStatus(settings.autoVoice)}\n`;
    statusText += `┃ 🔟 *Anti Badword:* ${getStatus(settings.antiBadword)}\n`;
    statusText += `┃ 1️⃣1️⃣ *Anti Delete:* ${getStatus(settings.antiDelete)}\n`;
    statusText += `┃\n`;
    statusText += `╰━━━━━━━━━━━━━━━┈⊷\n\n`;
    statusText += `*💡 අගය වෙනස් කිරීමට Reply කරන්න:*\n`;
    statusText += `*E.g:* \`4 on\` හෝ \`1 Zanta-Bot\``;

    const sentMsg = await zanta.sendMessage(from, {
        image: { url: SETTINGS_IMG },
        caption: statusText
    }, { quoted: mek });

    // පසුව Reply එක හඳුනා ගැනීමට ID එක සේව් කරයි
    lastSettingsMessage.set(from, sentMsg.key.id);

    // RAM Cleanup: විනාඩි 30කට පසු මේ ID එක Map එකෙන් අයින් කරයි
    setTimeout(() => {
        if (lastSettingsMessage.get(from) === sentMsg.key.id) {
            lastSettingsMessage.delete(from);
        }
    }, 30 * 60 * 1000); 
});

module.exports = { lastSettingsMessage };
