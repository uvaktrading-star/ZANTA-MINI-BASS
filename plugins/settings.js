const { cmd } = require("../command");
const { updateSetting } = require("./bot_db");
const config = require("../config");

const SETTINGS_IMG = "https://github.com/Akashkavindu/ZANTA_MD/blob/main/images/Gemini_Generated_Image_4xcl2e4xcl2e4xcl.png?raw=true";

// Settings Reply එක හඳුනා ගැනීමට (RAM එක බේරීමට විනාඩි 30කින් auto clean වේ)
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
    const webPass = settings.password === 'not_set' ? "Not Set ❌" : "Set ✅";

    // --- 📊 Status Indicators ---
    const getStatus = (val) => val === 'true' ? '✅' : '❌';

    let statusText = `╭━━━〔 ${botName.toUpperCase()} 〕━━━┈⊷\n`;
    statusText += `┃\n`;
    statusText += `┃ ❶ *Name:* ${botName}\n`;
    statusText += `┃ ❷ *Owner:* ${ownerName}\n`;
    statusText += `┃ ❸ *Prefix:* [ ${botPrefix} ]\n`;
    statusText += `┃ ❹ *Web Password:* ${webPass}\n`;
    statusText += `┃ ❺ *Always Online:* ${getStatus(settings.alwaysOnline)}\n`;
    statusText += `┃ ❻ *Auto Read Mg:* ${getStatus(settings.autoRead)}\n`;
    statusText += `┃ ❼ *Auto Typing:* ${getStatus(settings.autoTyping)}\n`;
    statusText += `┃ ❽ *Status Seen:* ${getStatus(settings.autoStatusSeen)}\n`;
    statusText += `┃ ❾ *Status React:* ${getStatus(settings.autoStatusReact)}\n`;
    statusText += `┃ ❿ *Read Command:* ${getStatus(settings.readCmd)}\n`;
    statusText += `┃ ⓫ *Auto Voice:* ${getStatus(settings.autoVoice)}\n`;
    statusText += `┃ ⓬ *Auto Reply:* ${getStatus(settings.autoReply)} (Set in web)\n`; // Update: දැන් ON/OFF පේනවා
    statusText += `┃\n`;
    statusText += `╰━━━━━━━━━━━━━━━┈⊷\n\n`;
    statusText += `*💡 අගය වෙනස් කිරීමට Reply කරන්න:*\n`;
    statusText += `*E.g:* \`5 on\` (Always Online ON කිරීමට)\n`;
    statusText += `*E.g:* \`12 off\` (Auto Reply OFF කිරීමට)\n`; // Example එකක් එකතු කළා
    statusText += `*E.g:* \`4 mypass123\` (Password එකක් දැමීමට)`;

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
