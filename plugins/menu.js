const { cmd, commands } = require("../command");
const os = require('os');
const config = require("../config");
const axios = require('axios'); 
const { generateWAMessageFromContent, prepareWAMessageMedia } = require("@whiskeysockets/baileys");

const MENU_IMAGE_URL = "https://github.com/Akashkavindu/ZANTA_MD/blob/main/images/zanta-md.png?raw=true";
const CHANNEL_JID = "120363406265537739@newsletter"; 
const lastMenuMessage = new Map();

let cachedMenuImage = null;

async function preLoadMenuImage() {
    try {
        const response = await axios.get(MENU_IMAGE_URL, { responseType: 'arraybuffer' });
        cachedMenuImage = Buffer.from(response.data);
    } catch (e) {
        cachedMenuImage = null; 
    }
}
preLoadMenuImage();

cmd({
    pattern: "menu",
    react: "📜",
    desc: "Displays the main menu.",
    category: "main",
    filename: __filename,
},
async (zanta, mek, m, { from, reply, args, userSettings, prefix }) => {
    try {
        const settings = userSettings || global.CURRENT_BOT_SETTINGS || {};
        const finalPrefix = prefix || settings.prefix || '.'; 
        const botName = settings.botName || "ZANTA-MD"; 
        const ownerName = settings.ownerName || 'Akash Kavindu';
        const mode = (settings.workType || "Public").toUpperCase();
        const isButtonsOn = settings.buttons === 'true';

        // Grouping
        const groupedCommands = {};
        const customOrder = ["main", "download", "tools", "logo", "media"];
        commands.filter(c => c.pattern && c.pattern !== "menu").forEach(cmdData => {
            let cat = cmdData.category?.toLowerCase() || "other";
            if (!groupedCommands[cat]) groupedCommands[cat] = [];
            groupedCommands[cat].push(cmdData);
        });

        const categoryKeys = Object.keys(groupedCommands).sort((a, b) => {
            let indexA = customOrder.indexOf(a);
            let indexB = customOrder.indexOf(b);
            return (indexA === -1 ? 99 : indexA) - (indexB === -1 ? 99 : indexB);
        });

        const contextInfo = {
            forwardingScore: 999,
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
                newsletterJid: CHANNEL_JID,
                serverMessageId: 100,
                newsletterName: "𝒁𝑨𝑵𝑻𝑨-𝑴𝑫 𝑶𝑭𝑭𝑰𝑪𝑰𝑨𝑳 </>"
            }
        };

        let headerText = `╭━〔 ${botName} WA BOT 〕━··๏\n┃ 👑 Owner : ${ownerName}\n┃ ⚙ Mode : ${mode}\n┃ 🔣 Prefix : ${finalPrefix}\n┃ 📚 Commands : ${commands.length}\n╰━━━━━━━━━━━━━━┈⊷\n`;

        if (isButtonsOn) {
            // --- 🔘 BUTTON ROWS ---
            const buttonRows = categoryKeys.map(catKey => ({
                header: "",
                title: `${catKey.toUpperCase()} MENU`,
                description: `View ${catKey} commands`,
                id: `cat_${catKey}`
            }));

            // --- 📦 INTERACTIVE MESSAGE CONTENT ---
            const interactiveMessage = {
                body: { text: headerText + "\nPlease select a category below." },
                footer: { text: `© ${botName} • 2026` },
                header: {
                    title: botName,
                    hasVideoDeterminer: false,
                    imageMessage: (await prepareWAMessageMedia({ image: { url: MENU_IMAGE_URL } }, { upload: zanta.waUploadToServer })).imageMessage
                },
                nativeFlowMessage: {
                    buttons: [
                        {
                            name: "single_select",
                            buttonParamsJson: JSON.stringify({
                                title: "📂 SELECT CATEGORY",
                                sections: [{ title: "COMMAND MENU", rows: buttonRows }]
                            })
                        },
                        {
                            name: "quick_reply",
                            buttonParamsJson: JSON.stringify({
                                display_text: "👤 OWNER",
                                id: `${finalPrefix}owner`
                            })
                        }
                    ]
                }
            };

            // --- 🚀 MESSAGE GENERATION & RELAY ---
            let msg = generateWAMessageFromContent(from, {
                viewOnceMessage: {
                    message: {
                        interactiveMessage: interactiveMessage,
                    }
                }
            }, { userJid: zanta.user.id, quoted: mek });

            return await zanta.relayMessage(from, msg.message, { messageId: msg.key.id });

        } else {
            // --- 📝 TEXT MENU ---
            let menuText = headerText + `\n╭━━〔 📜 MENU LIST 〕━━┈⊷\n`;
            categoryKeys.forEach((catKey, index) => {
                menuText += `┃ ${index + 1}. ${catKey.toUpperCase()} (${groupedCommands[catKey].length})\n`;
            });
            menuText += `╰━━━━━━━━━━━━━━┈⊷\n\n_💡 Reply with number to select._`;

            const sent = await zanta.sendMessage(from, {
                image: { url: MENU_IMAGE_URL },
                caption: menuText,
                contextInfo
            }, { quoted: mek });

            lastMenuMessage.set(from, sent.key.id);
        }
    } catch (err) {
        console.error(err);
        reply("❌ Button Error. Please check your Baileys version.");
    }
});

module.exports = { lastMenuMessage };
