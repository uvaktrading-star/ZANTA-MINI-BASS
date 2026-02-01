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
    const workType = (settings.workType || "public").toUpperCase();

    // --- 📊 Status Indicators ---
    const getStatus = (val) => val === 'true' ? '『 ✅ ON 』' : '『 ❌ OFF 』';
    
    // Anti-Delete සඳහා විශේෂ Indicator එකක්
    const getAntiDeleteStatus = (val) => {
        if (val === "1") return '『 👤 USER CHAT 』';
        if (val === "2") return '『 📥 YOUR CHAT 』';
        return '『 ❌ OFF 』';
    };

    let statusText = `⚡ *${botName.toUpperCase()} PREMIUM DASHBOARD* ⚡\n\n`;

    statusText += `*—「 BASIC CONFIGS 」—*\n\n`;
    statusText += `01. 🤖 *Bot Name:* ${botName}\n`;
    statusText += `02. 👤 *Owner Name:* ${ownerName}\n`;
    statusText += `03. 🎮 *Bot Prefix:* [ ${botPrefix} ]\n`;
    statusText += `04. 🔐 *Work Mode:* ${workType}\n`;
    statusText += `05. 🔑 *Web Password:* ${webPass}\n\n`;

    statusText += `*—「 BOT SETTINGS 」—*\n\n`;
    statusText += `06. 🚀 *Always Online:* ${getStatus(settings.alwaysOnline)}\n`;
    statusText += `07. 📩 *Auto Read:* ${getStatus(settings.autoRead)}\n`;
    statusText += `08. ⌨️ *Auto Typing:* ${getStatus(settings.autoTyping)}\n`;
    statusText += `09. 👁️ *Status Seen:* ${getStatus(settings.autoStatusSeen)}\n`;
    statusText += `10. ❤️ *Status React:* ${getStatus(settings.autoStatusReact)}\n`;
    statusText += `11. 📑 *Read Cmd:* ${getStatus(settings.readCmd)}\n`;
    statusText += `12. 🎙️ *Auto Voice:* ${getStatus(settings.autoVoice)}\n`;
    statusText += `13. 🤖 *Auto Reply:* ${getStatus(settings.autoReply)}\n`;
    statusText += `14. 🔔 *Connect Msg:* ${getStatus(settings.connectionMsg)}\n`;
    statusText += `15. 🔘 *Buttons Mod:* ${getStatus(settings.buttons)}\n`;
    statusText += `16. 🛡️ *Anti-Delete:* ${getAntiDeleteStatus(settings.antidelete)}\n`;
    statusText += `17. ⚡ *Auto React:* ${getStatus(settings.autoReact)}\n\n`;

    statusText += `*–––––––––––––––––––––––––*\n`;
    statusText += `*💡 EDIT SETTINGS:* \n`;
    statusText += `Reply with number + value.\n\n`;
    statusText += `*E.g for Anti-Delete:* \n`;
    statusText += `\`16 1\` (Send to User Chat)\n`;
    statusText += `\`16 2\` (Send to Your Chat)\n`;
    statusText += `\`16 false\` (Turn OFF)\n\n`;
    statusText += `*E.g:* \`17 on\` (Auto React ON)\n`;
    statusText += `*E.g:* \`1 MyBot\` (Bot Name change)\n`;
    statusText += `*–––––––––––––––––––––––––*\n`;
    statusText += `> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴢᴀɴᴛᴀ-ᴍᴅ*`;

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
