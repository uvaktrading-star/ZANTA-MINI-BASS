const { cmd, commands } = require("../command");
const os = require('os');
const config = require("../config");
const axios = require('axios'); 

const MENU_IMAGE_URL = "https://github.com/Akashkavindu/ZANTA_MD/blob/main/images/zanta-md.png?raw=true";
const CHANNEL_JID = "120363406265537739@newsletter"; 
const lastMenuMessage = new Map();

// --- 🖼️ IMAGE PRE-LOAD LOGIC ---
let cachedMenuImage = null;

async function preLoadMenuImage() {
    try {
        const response = await axios.get(MENU_IMAGE_URL, { responseType: 'arraybuffer' });
        cachedMenuImage = Buffer.from(response.data);
        console.log("✅ [CACHE] Menu image pre-loaded successfully.");
    } catch (e) {
        console.error("❌ [CACHE] Failed to pre-load menu image:", e.message);
        cachedMenuImage = null; 
    }
}

preLoadMenuImage();

cmd({
    pattern: "menu",
    react: "📜",
    desc: "Displays the main menu or a category list.",
    category: "main",
    filename: __filename,
},
async (zanta, mek, m, { from, reply, args, userSettings, prefix }) => {
    try {
        const settings = userSettings || global.CURRENT_BOT_SETTINGS || {};
        const finalPrefix = prefix || settings.prefix || config.DEFAULT_PREFIX || '.'; 
        const botName = settings.botName || config.DEFAULT_BOT_NAME || "ZANTA-MD"; 
        const ownerName = settings.ownerName || config.DEFAULT_OWNER_NAME || 'Akash Kavindu';
        const mode = (settings.workType || "Public").toUpperCase();
        const isButtonsOn = settings.buttons === 'true';

        let inputBody = m.body ? m.body.trim().toLowerCase() : "";
        const isNumber = /^\d+$/.test(inputBody); 
        const isCategorySelection = inputBody.startsWith('cat_');
        const isMainCmd = (inputBody === `${finalPrefix}menu` || inputBody === "menu");

        // Command Filter
        if (!isNumber && !isCategorySelection && !isMainCmd) return;
        if (isNumber && !isMainCmd) {
            if (!m.quoted || lastMenuMessage.get(from) !== m.quoted.id) return;
        }

        // Grouping Commands
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

        const categoryMap = {}; 
        categoryKeys.forEach((cat, index) => { categoryMap[index + 1] = cat; });

        let selectedCategory;
        if (isCategorySelection) {
            selectedCategory = inputBody.replace('cat_', '');
        } else if (isNumber) {
            selectedCategory = categoryMap[parseInt(inputBody)];
        }

        const contextInfo = {
            forwardingScore: 999,
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
                newsletterJid: CHANNEL_JID,
                serverMessageId: 100,
                newsletterName: "𝒁𝑨𝑵𝑻𝑨-𝑴𝑫 𝑶𝑭𝑭𝑰𝑪𝑰𝑨𝑳 </>"
            }
        };

        // --- Category display logic ---
        if (selectedCategory && groupedCommands[selectedCategory]) {
            let displayTitle = selectedCategory.toUpperCase();
            let emoji = { main: '🏠', download: '📥', tools: '🛠', logo: '🎨', media: '🖼' }[selectedCategory.toLowerCase()] || '📌';

            let commandList = `╭━━〔 ${emoji} ${displayTitle} 〕━━┈⊷\n`;
            commandList += `┃ 📝 Category : ${displayTitle}\n┃ 📊 Available : ${groupedCommands[selectedCategory].length}\n╰━━━━━━━━━━━━━━┈⊷\n\n`;

            groupedCommands[selectedCategory].forEach((c) => {
                commandList += `┃ ◈ ⚡ ${finalPrefix}${c.pattern}\n`;
            });
            commandList += `╰━━━━━━━━━━━━━━┈⊷\n\n> *© ${botName}*`;

            return await zanta.sendMessage(from, { text: commandList, contextInfo }, { quoted: mek }); 
        }

        // --- Main Menu header ---
        let headerText = `╭━〔 ${botName} WA BOT 〕━··๏\n`;
        headerText += `┃ 👑 Owner : ${ownerName}\n┃ ⚙ Mode : ${mode}\n┃ 🔣 Prefix : ${finalPrefix}\n┃ 📚 Commands : ${commands.length}\n╰━━━━━━━━━━━━━━┈⊷\n\n`;

        let imageToDisplay;
        if (settings.botImage && settings.botImage !== "null" && settings.botImage.startsWith("http")) {
            imageToDisplay = { url: settings.botImage };
        } else {
            imageToDisplay = cachedMenuImage || { url: MENU_IMAGE_URL };
        }

        if (isButtonsOn) {
            // --- 🔘 INTERACTIVE BUTTONS LOGIC ---
            const buttonRows = categoryKeys.map(catKey => {
                let title = catKey.toUpperCase();
                let emoji = { main: '🏠', download: '📥', tools: '🛠', logo: '🎨', media: '🖼' }[catKey] || '📌';
                return {
                    header: "",
                    title: `${emoji} ${title} MENU`,
                    description: `View ${title} category commands`,
                    id: `cat_${catKey}`
                };
            });

            const buttons = [
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
            ];

            const messageContent = {
                interactiveMessage: {
                    header: {
                        title: botName,
                        hasVideoDeterminer: false,
                        // prepareWAMessageMedia භාවිතා කර image එක සකසයි
                        imageMessage: (await zanta.prepareWAMessageMedia({ image: imageToDisplay }, { upload: zanta.waUploadToServer })).imageMessage
                    },
                    body: { text: headerText + "Please select a category from the button below." },
                    footer: { text: `© ${botName} • 2026` },
                    nativeFlowMessage: { buttons: buttons },
                    contextInfo: contextInfo
                }
            };

            // relayMessage එක නිවැරදිව generateWAMessageFromContent සමඟ භාවිතා කිරීම
            const { generateWAMessageFromContent } = require("@whiskeysockets/baileys");
            const msg = generateWAMessageFromContent(from, {
                viewOnceMessage: {
                    message: messageContent
                }
            }, { userJid: zanta.user.id, quoted: mek });

            return await zanta.relayMessage(from, msg.message, { messageId: msg.key.id });

        } else {
            // --- 📝 NON-BUTTON MENU (REPLY NUMBER) ---
            let menuText = headerText + `╭━━〔 📜 MENU LIST 〕━━┈⊷\n`;
            categoryKeys.forEach((catKey, index) => {
                let title = catKey.toUpperCase();
                let emoji = { main: '🏠', download: '📥', tools: '🛠', logo: '🎨', media: '🖼' }[catKey] || '📌';
                menuText += `┃ ${index + 1}. ${emoji} ${title} (${groupedCommands[catKey].length})\n`;
            });
            menuText += `╰━━━━━━━━━━━━━━┈⊷\n\n_💡 Reply with number to select._`;

            const sent = await zanta.sendMessage(from, {
                image: imageToDisplay,
                caption: menuText,
                contextInfo
            }, { quoted: mek });

            lastMenuMessage.set(from, sent.key.id);
            setTimeout(() => lastMenuMessage.delete(from), 10 * 60 * 1000);
        }

    } catch (err) {
        console.error("Menu Error:", err);
        reply("❌ Error generating menu.");
    }
});

module.exports = { lastMenuMessage };
