const { cmd } = require("../command");
const { updateSetting } = require("./bot_db");
const config = require("../config");

const SETTINGS_IMG = "https://github.com/Akashkavindu/ZANTA_MD/blob/main/images/Gemini_Generated_Image_4xcl2e4xcl2e4xcl.png?raw=true";

// Settings Reply එක හඳුනා ගැනීමට
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

    // Work Type අගය ලබා ගැනීම
    const workType = (settings.workType || "public").toUpperCase();

    // --- 📊 Status Indicators ---
    const getStatus = (val) => val === 'true' ? '✅' : '❌';

    let statusText = `╭━━━〔 ${botName.toUpperCase()} 〕━━━┈⊷\n`;
    statusText += `┃\n`;
    statusText += `┃ ❶ *Name:* ${botName}\n`;
    statusText += `┃ ❷ *Owner:* ${ownerName}\n`;
    statusText += `┃ ❸ *Prefix:* [ ${botPrefix} ]\n`;
    statusText += `┃ ❹ *Work Type:* ${workType} 🔒\n`; 
    statusText += `┃ ❺ *Web Password:* ${webPass}\n`;
    statusText += `┃ ❻ *Always Online:* ${getStatus(settings.alwaysOnline)}\n`;
    statusText += `┃ ❼ *Auto Read Mg:* ${getStatus(settings.autoRead)}\n`;
    statusText += `┃ ❽ *Auto Typing:* ${getStatus(settings.autoTyping)}\n`;
    statusText += `┃ ❾ *Status Seen:* ${getStatus(settings.autoStatusSeen)}\n`;
    statusText += `┃ ❿ *Status React:* ${getStatus(settings.autoStatusReact)}\n`;
    statusText += `┃ ⓫ *Read Command:* ${getStatus(settings.readCmd)}\n`;
    statusText += `┃ ⓬ *Auto Voice:* ${getStatus(settings.autoVoice)}\n`;
    statusText += `┃ ⓭ *Auto Reply:* ${getStatus(settings.autoReply)}\n`;
    statusText += `┃ ⓮ *Connect Msg:* ${getStatus(settings.connectionMsg)}\n`;
    statusText += `┃ ⓯ *Buttons Mod:* ${getStatus(settings.buttons)}\n`; // ✅ අලුතින් එක් කළා
    statusText += `┃\n`;
    statusText += `╰━━━━━━━━━━━━━━━┈⊷\n\n`;
    statusText += `*💡 අගය වෙනස් කිරීමට Reply කරන්න:*\n`;
    statusText += `*E.g:* \`4 private\` (Private කිරීමට)\n`; 
    statusText += `*E.g:* \`15 on\` (Buttons ON කිරීමට)\n`; // Example එකක් එක් කළා
    statusText += `*E.g:* \`6 off\` (Always Online OFF කිරීමට)`;

    const sentMsg = await zanta.sendMessage(from, {
        image: { url: SETTINGS_IMG },
        caption: statusText
    }, { quoted: mek });

    lastSettingsMessage.set(from, sentMsg.key.id);

    // RAM Cleanup
    setTimeout(() => {
        if (lastSettingsMessage.get(from) === sentMsg.key.id) {
            lastSettingsMessage.delete(from);
        }
    }, 30 * 60 * 1000); 
});

module.exports = { lastSettingsMessage };
