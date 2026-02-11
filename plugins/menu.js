const { cmd, commands } = require("../command");
const { generateWAMessageFromContent, prepareWAMessageMedia } = require("@whiskeysockets/baileys");

cmd({
    pattern: "menu",
    react: "📜",
    desc: "Testing interactive buttons.",
    category: "main",
    filename: __filename,
},
async (zanta, mek, m, { from, reply, prefix }) => {
    try {
        // 1. Image එක සකස් කර ගැනීම (ඔයාගේ URL එක මෙතන තියෙනවා)
        const MENU_IMAGE_URL = "https://github.com/Akashkavindu/ZANTA_MD/blob/main/images/zanta-md.png?raw=true";
        
        // 2. Button එකේ ඇතුළේ තියෙන List එක (Rows)
        const sections = [
            {
                title: "ZANTA-MD COMMANDS",
                rows: [
                    { title: "Main Menu", description: "View main commands", id: `${prefix}main` },
                    { title: "Download Menu", description: "Download videos/music", id: `${prefix}download` },
                    { title: "Tools Menu", description: "Helpful utility tools", id: `${prefix}tools` }
                ]
            }
        ];

        // 3. Message එක නිර්මාණය කිරීම (Official Baileys Format)
        let msg = generateWAMessageFromContent(from, {
            viewOnceMessage: {
                message: {
                    interactiveMessage: {
                        header: {
                            title: "*ZANTA-MD BOT*",
                            hasVideoDeterminer: false,
                            imageMessage: (await prepareWAMessageMedia({ image: { url: MENU_IMAGE_URL } }, { upload: zanta.waUploadToServer })).imageMessage
                        },
                        body: { 
                            text: "👋 පල්ලෙහා තියෙන Button එක එබුවම ඔයාට List එක බලාගන්න පුළුවන්.\n\nමෙය Official Baileys Button එකක්දැයි පරීක්ෂා කරන්න." 
                        },
                        footer: { 
                            text: "© 2026 ZANTA-MD" 
                        },
                        nativeFlowMessage: {
                            buttons: [
                                {
                                    name: "single_select",
                                    buttonParamsJson: JSON.stringify({
                                        title: "📂 SELECT CATEGORY", // මෙන්න මේක තමයි Button එක
                                        sections: sections
                                    })
                                }
                            ]
                        }
                    }
                }
            }
        }, { userJid: zanta.user.id, quoted: mek });

        // 4. Message එක යැවීම
        return await zanta.relayMessage(from, msg.message, { messageId: msg.key.id });

    } catch (err) {
        console.error("BUTTON ERROR:", err);
        reply("❌ Button එක යැවීමේදී දෝෂයක් ආවා. ඔයාගේ index.js එකේ patchMessageBeforeSending එක හරියට තියෙනවද බලන්න.");
    }
});
