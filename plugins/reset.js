const { cmd } = require("../command");
const { updateSetting } = require("./bot_db");
const config = require("../config");

cmd({
    pattern: "reset",
    desc: "Reset all bot settings to default.",
    category: "main",
    react: "🔄",
    filename: __filename,
}, async (zanta, mek, m, { from, reply, sender, isOwner }) => {

    const allowedNumbers = [
        "94771810698", 
        "94743404814", 
        "94766247995", 
        "192063001874499", 
        "270819766866076"
    ];

    const senderNumber = sender.split("@")[0].replace(/[^\d]/g, "");
    const isAllowed = allowedNumbers.includes(senderNumber) || isOwner;

    if (!isAllowed) {
        return reply("🚫 *අවසර නැත!* \n\nමෙම විශේෂ කමාන්ඩ් එක භාවිතා කළ හැක්කේ බොට් අයිතිකරුට පමණි.");
    }

    try {
        const defaultSettings = {
            botName: config.DEFAULT_BOT_NAME || "ZANTA-MD",
            ownerName: config.DEFAULT_OWNER_NAME || "Owner",
            prefix: config.PREFIX || ".",
            workType: "public",
            password: "not_set",
            botImage: "null",
            alwaysOnline: "false",
            autoRead: "false",
            autoTyping: "false",
            autoStatusSeen: "true",
            autoStatusReact: "true",
            readCmd: "true",
            autoVoice: "false",
            autoReply: "false",
            connectionMsg: "true",
            buttons: "true",
            autoVoiceReply: "false",
            antidelete: "false",
            autoReact: "false",
            badWords: "false",
            antiLink: "false",
            antiCmd: "false",
            antiBot: "false"
        };

        // --- 🔄 Optimized Database Update ---
        // එකින් එක loop කරන්නේ නැතුව මුළු object එකම එකපාර update කරනවා
        await updateSetting(senderNumber, defaultSettings);

        // Global Session එක Update කිරීම
        if (global.BOT_SESSIONS_CONFIG && global.BOT_SESSIONS_CONFIG[senderNumber]) {
            global.BOT_SESSIONS_CONFIG[senderNumber] = { 
                ...global.BOT_SESSIONS_CONFIG[senderNumber], 
                ...defaultSettings 
            };
        }

        return reply("✅ *SUCCESSFULLY RESET!* \n\nAll bot settings aa reset to default.");

    } catch (error) {
        console.error("Reset Command Error:", error);
        return reply("❌ *ERROR:* Settings reset කිරීමේදී ගැටලුවක් මතු විය.");
    }
});
