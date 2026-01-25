const { cmd } = require("../command");
const { updateSetting } = require("./bot_db");
const config = require("../config");

const SETTINGS_IMG = "https://github.com/Akashkavindu/ZANTA_MD/blob/main/images/zanta-md.png?raw=true";

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
    const getStatus = (val) => val === 'true' ? '✅ ON' : '❌ OFF';

    let statusText = `✨ *${botName.toUpperCase()} DASHBOARD* ✨\n\n`;
    
    statusText += `👤 *Owner:* ${ownerName}\n`;
    statusText += `⚙️ *Prefix:* [ ${botPrefix} ]\n`;
    statusText += `🔓 *Work Type:* ${workType}\n`;
    statusText += `🔐 *Web Pass:* ${webPass}\n\n`;

    statusText += `╔════════════════════╗\n`;
    statusText += `┋ 0️⃣1️⃣ *Bot Name:* ${botName}\n`;
    statusText += `┋ 0️⃣2️⃣ *Owner Name:* ${ownerName}\n`;
    statusText += `┋ 0️⃣3️⃣ *Prefix:* ${botPrefix}\n`;
    statusText += `┋ 0️⃣4️⃣ *Work Type:* ${workType}\n`;
    statusText += `┋ 0️⃣5️⃣ *Web Pass:* ${webPass}\n`;
    statusText += `┋ 0️⃣6️⃣ *Always Online:* ${getStatus(settings.alwaysOnline)}\n`;
    statusText += `┋ 0️⃣7️⃣ *Auto Read:* ${getStatus(settings.autoRead)}\n`;
    statusText += `┋ 0️⃣8️⃣ *Auto Typing:* ${getStatus(settings.autoTyping)}\n`;
    statusText += `┋ 0️⃣9️⃣ *Status Seen:* ${getStatus(settings.autoStatusSeen)}\n`;
    statusText += `┋ 1️⃣0️⃣ *Status React:* ${getStatus(settings.autoStatusReact)}\n`;
    statusText += `┋ 1️⃣1️⃣ *Read Cmd:* ${getStatus(settings.readCmd)}\n`;
    statusText += `┋ 1️⃣2️⃣ *Auto Voice:* ${getStatus(settings.autoVoice)}\n`;
    statusText += `┋ 1️⃣3️⃣ *Auto Reply:* ${getStatus(settings.autoReply)}\n`;
    statusText += `┋ 1️⃣4️⃣ *Connect Msg:* ${getStatus(settings.connectionMsg)}\n`;
    statusText += `┋ 1️⃣5️⃣ *Buttons:* ${getStatus(settings.buttons)}\n`;
    // --- 🆕 [ADDED] ANTIDELETE SETTING ---
    statusText += `┋ 1️⃣6️⃣ *Anti Delete:* ${getStatus(settings.antidelete)}\n`;
    statusText += `╚════════════════════╝\n\n`;

    statusText += `*📝 භාවිතා කරන ආකාරය:* \n`;
    statusText += `අගය වෙනස් කිරීමට අංකය සහ අදාළ අගය Reply කරන්න.\n\n`;
    statusText += `*E.g:* \`16 on\` (Anti-Delete සක්‍රිය කිරීමට)\n`;
    statusText += `*E.g:* \`4 \` (Private Mode කිරීමට)\n`;
    statusText += `*E.g:* \`6 off\` (Always Online අක්‍රිය කිරීමට)\n\n`;
    statusText += `> *Powered by ZANTA-MD*`;

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
