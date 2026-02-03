const { cmd } = require("../command");
const { updateSetting } = require("./bot_db");
const config = require("../config");

// Default Image Link
const DEFAULT_IMG = "https://github.com/Akashkavindu/ZANTA_MD/blob/main/images/Gemini_Generated_Image_4xcl2e4xcl2e4xcl.png?raw=true";

const lastSettingsMessage = new Map();

cmd({
    pattern: "settings",
    alias: ["set", "dashboard", "status"],
    desc: "Display and edit bot settings via reply.",
    category: "main",
    react: "⚙️",
    filename: __filename,
}, async (zanta, mek, m, { from, reply, sender, isOwner, prefix, userSettings }) => {

    // --- 🛡️ Access Control ---
    const allowedNumbers = ["94771810698", "94743404814", "94766247995", "192063001874499", "270819766866076"];
    const senderNumber = sender.split("@")[0].replace(/[^\d]/g, '');
    const isSpecialOwner = allowedNumbers.includes(senderNumber) || isOwner;
    const isPaidUser = userSettings && userSettings.paymentStatus === "paid";

    if (!isSpecialOwner && !isPaidUser) return reply("⚠️ *මෙම Dashboard එක භාවිතා කළ හැක්කේ බොට් අයිතිකරුට හෝ Paid Users ලාට පමණි!*");

    const settings = userSettings || global.CURRENT_BOT_SETTINGS || {};
    const botName = settings.botName || config.DEFAULT_BOT_NAME || "ZANTA-MD";
    const ownerName = settings.ownerName || config.DEFAULT_OWNER_NAME || "Owner";
    const botPrefix = settings.prefix || prefix || ".";
    const webPass = settings.password === 'not_set' ? "Not Set ❌" : "Set ✅";
    const workType = (settings.workType || "public").toUpperCase();
    
    // Bot Image Status
    const botImageStatus = (settings.botImage && settings.botImage !== "null") ? "Updated ✅" : "Default 🖼️";
    const displayImg = (settings.botImage && settings.botImage !== "null") ? settings.botImage : DEFAULT_IMG;

    // --- 📊 Status Indicators ---
    const getStatus = (val) => val === 'true' ? '『 ✅ ON 』' : '『 ❌ OFF 』';
    
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
    statusText += `05. 🔑 *Web Password:* ${webPass}\n`;
    statusText += `06. 🖼️ *Bot Image:* ${botImageStatus}\n\n`; // අලුතින් එක් කළ 6 වෙනි අයිතමය

    statusText += `*—「 BOT SETTINGS 」—*\n\n`;
    statusText += `07. 🚀 *Always Online:* ${getStatus(settings.alwaysOnline)}\n`;
    statusText += `08. 📩 *Auto Read:* ${getStatus(settings.autoRead)}\n`;
    statusText += `09. ⌨️ *Auto Typing:* ${getStatus(settings.autoTyping)}\n`;
    statusText += `10. 👁️ *Status Seen:* ${getStatus(settings.autoStatusSeen)}\n`;
    statusText += `11. ❤️ *Status React:* ${getStatus(settings.autoStatusReact)}\n`;
    statusText += `12. 📑 *Read Cmd:* ${getStatus(settings.readCmd)}\n`;
    statusText += `13. 🎙️ *Auto Voice:* ${getStatus(settings.autoVoice)}\n`;
    statusText += `14. 🤖 *Auto Reply:* ${getStatus(settings.autoReply)}\n`;
    statusText += `15. 🔔 *Connect Msg:* ${getStatus(settings.connectionMsg)}\n`;
    statusText += `16. 🔘 *Buttons Mod:* ${getStatus(settings.buttons)}\n`;
    statusText += `17. 🛡️ *Anti-Delete:* ${getAntiDeleteStatus(settings.antidelete)}\n`;
    statusText += `18. ⚡ *Auto React:* ${getStatus(settings.autoReact)}\n\n`;

    statusText += `*–––––––––––––––––––––––––*\n`;
    statusText += `*💡 EDIT SETTINGS:* \n`;
    statusText += `Reply with number + value.\n\n`;
    statusText += `*E.g for Bot Image:* \n`;
    statusText += `\`06 https://image-url.jpg\`\n\n`;
    statusText += `*–––––––––––––––––––––––––*\n`;
    statusText += `> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴢᴀɴᴛᴀ-ᴍᴅ*`;

    const sentMsg = await zanta.sendMessage(from, {
        image: { url: displayImg },
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
