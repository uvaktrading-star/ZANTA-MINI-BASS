const { cmd, commands } = require("../command");

cmd({
    pattern: "menu",
    react: "💎",
    desc: "100% Working List Menu.",
    category: "main",
    filename: __filename,
},
async (zanta, mek, m, { from, reply, userSettings, prefix }) => {
    try {
        let menuCaption = `✨ *𝐙𝐀𝐍𝐓𝐀-𝐌𝐃 𝐔𝐋𝐓𝐑𝐀* ✨
        
👋 ʜᴇʏ *${m.pushName}*
🖥️ 𝚁𝚞𝚗𝚝𝚒𝚖𝚎 : ${process.uptime().toFixed(0)} 𝚜𝚎𝚌𝚘𝚗𝚍𝚜`;

        // මෙනු එක List එකක් ලෙස සකස් කිරීම
        const sections = [
            {
                title: "📋 Main Commands",
                rows: [
                    { title: "All Menu", rowId: `${prefix}allmenu`, description: "Show all commands" },
                    { title: "Download Menu", rowId: `${prefix}downmenu`, description: "Download videos/songs" },
                    { title: "Bot Settings", rowId: `${prefix}settings`, description: "Configure your bot" }
                ]
            },
            {
                title: "⚙️ System",
                rows: [
                    { title: "Ping Speed", rowId: `${prefix}ping`, description: "Check bot speed" },
                    { title: "System Info", rowId: `${prefix}system`, description: "Check RAM/CPU usage" }
                ]
            }
        ];

        const listMessage = {
            text: menuCaption,
            footer: "💎 ZANTA-MD Selection Menu",
            title: "🔱 𝐙𝐀𝐍𝐓𝐀 𝐌𝐔𝐒𝐈𝐂 🔱",
            buttonText: "Click Here to Select", // මෙතන තමයි බටන් එක පේන්නේ
            sections
        };

        // List message එක යැවීම
        return await zanta.sendMessage(from, listMessage, { quoted: mek });

    } catch (err) {
        console.error(err);
        reply("❌ Error: " + err.message);
    }
});
