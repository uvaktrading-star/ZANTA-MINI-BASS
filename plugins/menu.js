const { cmd, commands } = require("../command");
const { generateWAMessageFromContent, proto, prepareWAMessageMedia } = require("@whiskeysockets/baileys");
const os = require('os');
const config = require("../config");

const MENU_IMAGE_URL = "https://github.com/Akashkavindu/ZANTA_MD/blob/main/images/menu-new.jpg?raw=true";

cmd({
    pattern: "menu",
    react: "💎",
    desc: "Premium Interactive Menu.",
    category: "main",
    filename: __filename,
},
async (zanta, mek, m, { from, reply, userSettings, prefix }) => {
    try {
        const settings = userSettings || global.CURRENT_BOT_SETTINGS || {};
        const runtime = Number(process.uptime().toFixed(0));
        const hours = Math.floor(runtime / 3600);
        const minutes = Math.floor((runtime % 3600) / 60);
        const seconds = runtime % 60;
        const memory = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);

        let menuCaption = `✨ *𝐙𝐀𝐍𝐓𝐀-𝐌𝐃 𝐔𝐋𝐓𝐑𝐀* ✨

👋 ʜᴇʏ *${m.pushName || 'User'}*

🖥️ *𝐒𝐘𝐒𝐓𝐄𝐌 𝐒𝐓𝐀𝐓𝐒*
⏳ 𝚁𝚞𝚗 : ${hours}𝚑 ${minutes}𝚖
🧠 𝚁𝚊𝚖 : ${memory}𝙼𝙱 / 𝟻𝟷𝟸𝙼𝙱
🧬 𝚂𝚝𝚊𝚝𝚞𝚜 : 𝙾𝚗𝚕𝚒𝚗𝚎

🛡️ _𝙿𝚘𝚠𝚎𝚛𝚎𝚍 𝙱𝚢 𝚉𝙰𝙽𝚃𝙰 𝙾𝙵𝙲_ 🚀`;

        // 🖼️ Image එක මුලින්ම Prepare කරගන්නවා (Error එක නොවෙන්න)
        const media = await prepareWAMessageMedia({ image: { url: MENU_IMAGE_URL } }, { upload: zanta.waUploadToServer });

        const interactiveMessage = {
            body: { text: menuCaption },
            footer: { text: "💎 ZANTA-MD Premium Edition" },
            header: {
                title: "🔱 𝐙𝐀𝐍𝐓𝐀 𝐌𝐔𝐒𝐈𝐂 🔱",
                hasMediaAttachment: true,
                imageMessage: media.imageMessage
            },
            nativeFlowMessage: {
                buttons: [
                    {
                        "name": "quick_reply",
                        "buttonParamsJson": JSON.stringify({
                            "display_text": "📂 ALL COMMANDS",
                            "id": `${prefix}allmenu`
                        })
                    },
                    {
                        "name": "quick_reply",
                        "buttonParamsJson": JSON.stringify({
                            "display_text": "📥 DOWNLOADER",
                            "id": `${prefix}downmenu`
                        })
                    },
                    {
                        "name": "quick_reply",
                        "buttonParamsJson": JSON.stringify({
                            "display_text": "📡 PING SPEED",
                            "id": `${prefix}ping`
                        })
                    }
                ]
            }
        };

        const msg = generateWAMessageFromContent(from, {
            viewOnceMessage: {
                message: {
                    interactiveMessage: interactiveMessage
                }
            }
        }, { userJid: from, quoted: mek });

        return await zanta.relayMessage(from, msg.message, { messageId: msg.key.id });

    } catch (err) {
        console.error("Menu Error Debug:", err);
        reply("❌ Button Menu Error: " + err.message);
    }
});
