const { cmd } = require("../command");
const { updateSetting } = require("./bot_db");
const config = require("../config"); // config එකත් import කරගත්තා default අගයන් ගන්න

// 🖼️ Dashboard Image URL
const SETTINGS_IMG = "https://github.com/Akashkavindu/ZANTA_MD/blob/main/images/settings.jpg?raw=true";

// 🎯 Reply හඳුනා ගැනීම සඳහා පාවිච්චි කරන Map එක
const lastSettingsMessage = new Map();

cmd({
    pattern: "settings",
    alias: ["set", "dashboard", "status"],
    desc: "Display and edit bot settings via reply.",
    category: "main",
    react: "⚙️",
    filename: __filename,
}, async (zanta, mek, m, { from, reply, isOwner, prefix, userSettings }) => {
    // අයිතිකරුදැයි පරීක්ෂා කිරීම
    if (!isOwner) return reply("⚠️ *මෙම Dashboard එක භාවිතා කළ හැක්කේ බොට් අයිතිකරුට පමණි!*");

    // [වැදගත් වෙනස]: index.js එකෙන් එවන userSettings ගන්නවා, නැත්නම් global එක ගන්නවා
    const settings = userSettings || global.CURRENT_BOT_SETTINGS;

    // පෙන්වීමට ගන්නා අගයන් (Settings හි නැත්නම් config එකෙන් හෝ default එකක් ගනී)
    const botName = settings.botName || config.DEFAULT_BOT_NAME || "ZANTA-MD";
    const ownerName = settings.ownerName || config.DEFAULT_OWNER_NAME || "Owner";
    const botPrefix = settings.prefix || prefix || ".";

    // --- 📊 Dashboard Text Design ---
    let statusText = `╭━━━〔 ${botName.toUpperCase()} 〕━━━┈⊷\n`;
    statusText += `┃\n`;
    statusText += `┃ 1️⃣ *Bot Name:* ${botName}\n`;
    statusText += `┃ 2️⃣ *Owner Name:* ${ownerName}\n`;
    statusText += `┃ 3️⃣ *Prefix:* [  ${botPrefix}  ]\n`;
    statusText += `┃ 4️⃣ *Auto Read msg:* ${settings.autoRead === 'true' ? '✅ ON' : '❌ OFF'}\n`;
    statusText += `┃ 5️⃣ *Auto Typing:* ${settings.autoTyping === 'true' ? '✅ ON' : '❌ OFF'}\n`;
    statusText += `┃ 6️⃣ *Status Seen:* ${settings.autoStatusSeen === 'true' ? '✅ ON' : '❌ OFF'}\n`;
    statusText += `┃ 7️⃣ *Always Online:* ${settings.alwaysOnline === 'true' ? '✅ ON' : '❌ OFF'}\n`;
    statusText += `┃ 8️⃣ *Read Commands:* ${settings.readCmd === 'true' ? '✅ ON' : '❌ OFF'}\n`;
    statusText += `┃ 9️⃣ *Auto Voice:* ${settings.autoVoice === 'true' ? '✅ ON' : '❌ OFF'}\n`;
    statusText += `┃ 🔟 *Anti Badword:* ${settings.antiBadword === 'true' ? '✅ ON' : '❌ OFF'}\n`;
    statusText += `┃\n`;
    statusText += `╰━━━━━━━━━━━━━━━┈⊷\n\n`;
    statusText += `*💡 සෙටින්ග්ස් වෙනස් කරන්නේ කෙසේද?*\n`;
    statusText += `අදාළ අංකය සහ අලුත් අගය මෙම පණිවිඩයට Reply කරන්න.\n\n`;
    statusText += `*E.g:* \`10 on\` හෝ \`1 MyBotName\`\n`;

    const sentMsg = await zanta.sendMessage(from, {
        image: { url: SETTINGS_IMG },
        caption: statusText
    }, { quoted: mek });

    // පසුව Reply එකක් ආ විට හඳුනා ගැනීමට මැසේජ් ID එක මතක තබා ගනී
    lastSettingsMessage.set(from, sentMsg.key.id);
});

// index.js වෙත අපනයනය කිරීම
module.exports = { lastSettingsMessage };
