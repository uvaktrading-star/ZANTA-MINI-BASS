const { cmd } = require("../command");

cmd({
    pattern: "menu",
    react: "💎",
    desc: "Interactive Menu with Buttons",
    category: "main",
    filename: __filename,
},
async (zanta, mek, m, { from, prefix }) => {
    try {
        let menuCaption = `✨ *𝐙𝐀𝐍𝐓𝐀-𝐌𝐃 𝐔𝐋𝐓𝐑𝐀* ✨
👋 ʜᴇʏ *${m.pushName}*`;

        // Interactive Message එකක් ලෙස සකස් කිරීම
        const message = {
            interactiveMessage: {
                header: {
                    hasVideoMessage: false,
                    hasImageMessage: true,
                    imageMessage: (await zanta.prepareWAMessageMedia({ image: { url: "https://github.com/Akashkavindu/ZANTA_MD/blob/main/images/menu-new.jpg?raw=true" } }, { upload: zanta.waUploadToServer })).imageMessage,
                    title: "🔱 ZANTA MUSIC 🔱",
                },
                body: { text: menuCaption },
                footer: { text: "💎 ZANTA-MD : The Ultimate Assistant" },
                nativeFlowMessage: {
                    buttons: [
                        {
                            name: "quick_reply",
                            buttonParamsJson: JSON.stringify({
                                display_text: "📂 ALL MENU",
                                id: `${prefix}allmenu`
                            })
                        },
                        {
                            name: "quick_reply",
                            buttonParamsJson: JSON.stringify({
                                display_text: "📥 DOWNLOAD",
                                id: `${prefix}downmenu`
                            })
                        }
                    ]
                }
            }
        };

        // මෙය relayMessage එකක් ලෙස යැවීම (වැදගත්ම කොටස)
        const msg = await zanta.relayMessage(from, { viewOnceMessage: { message } }, {});
        return msg;

    } catch (err) {
        console.error(err);
        zanta.sendMessage(from, { text: "❌ Menu Error: " + err.message }, { quoted: mek });
    }
});
