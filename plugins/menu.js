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
    } catch (e) {
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
        const finalPrefix = prefix || settings.prefix || '.'; 
        const botName = settings.botName || "ZANTA-MD"; 
        const ownerName = settings.ownerName || 'Akash Kavindu';
        const mode = (settings.workType || "Public").toUpperCase();

        let inputBody = m.body ? m.body.trim().toLowerCase() : "";
        const isNumber = /^\d+$/.test(inputBody); 
        
        // --- COMMAND GROUPING ---
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

        // --- NEWSLETTER CONTEXT ---
        const contextInfo = {
            forwardingScore: 999,
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
                newsletterJid: CHANNEL_JID,
                serverMessageId: 100,
                newsletterName: "𝒁𝑨𝑵𝑻𝑨-𝑴𝑫 𝑶𝑭𝑭𝑰𝑪𝑰𝑨𝑳 </>"
            }
        };

        // --- 🖼️ IMAGE LOGIC ---
        let imageToDisplay;
        if (settings.botImage && settings.botImage !== "null" && settings.botImage.startsWith("http")) {
            imageToDisplay = { url: settings.botImage };
        } else {
            imageToDisplay = cachedMenuImage || { url: MENU_IMAGE_URL };
        }

        // --- 📂 CATEGORY SELECTION (REPLY LOGIC) ---
        if (isNumber && m.quoted && lastMenuMessage.get(from) === m.quoted.id) {
            const selectedCategory = categoryMap[parseInt(inputBody)];
            
            if (selectedCategory && groupedCommands[selectedCategory]) {
                let displayTitle = selectedCategory.toUpperCase();
                let emoji = { main: '🏠', download: '📥', tools: '🛠', logo: '🎨', media: '🖼' }[selectedCategory.toLowerCase()] || '📌';

                let commandList = `╭━━〔 ${emoji} ${displayTitle} 〕━━┈⊷\n`;
                commandList += `┃ 📝 Category : ${displayTitle}\n┃ 📊 Available : ${groupedCommands[selectedCategory].length}\n╰━━━━━━━━━━━━━━┈⊷\n\n`;

                groupedCommands[selectedCategory].forEach((c) => {
                    commandList += `┃ ◈ ⚡ ${finalPrefix}${c.pattern}\n`;
                });
                commandList += `\n╰━━━━━━━━━━━━━━┈⊷\n\n> *© ${botName}*`;

                return await zanta.sendMessage(from, { text: commandList, contextInfo }, { quoted: mek }); 
            }
        }

        // --- 📜 MAIN MENU TEXT ---
        let headerText = `╭━〔 ${botName} WA BOT 〕━··๏\n`;
        headerText += `┃ 👑 Owner : ${ownerName}\n┃ ⚙ Mode : ${mode}\n┃ 🔣 Prefix : ${finalPrefix}\n┃ 📚 Commands : ${commands.length}\n╰━━━━━━━━━━━━━━┈⊷\n\n`;
        
        let menuText = headerText + `╭━━〔 📜 MENU LIST 〕━━┈⊷\n`;
        categoryKeys.forEach((catKey, index) => {
            let title = catKey.toUpperCase();
            let emoji = { main: '🏠', download: '📥', tools: '🛠', logo: '🎨', media: '🖼' }[catKey] || '📌';
            menuText += `┃ ${index + 1}. ${emoji} ${title} (${groupedCommands[catKey].length})\n`;
        });
        menuText += `╰━━━━━━━━━━━━━━┈⊷\n\n_💡 Reply with a number to view commands._\n\n> *© ${botName} • 2026*`;

        const sent = await zanta.sendMessage(from, {
            image: imageToDisplay,
            caption: menuText,
            contextInfo
        }, { quoted: mek });

        // අංකයකින් reply කරන තෙක් message ID එක මතක තබා ගනී (මිනිත්තු 15 ක්)
        lastMenuMessage.set(from, sent.key.id);
        setTimeout(() => lastMenuMessage.delete(from), 15 * 60 * 1000);

    } catch (err) {
        console.error("Menu Error:", err);
        reply("❌ Error generating menu.");
    }
});

module.exports = { lastMenuMessage };
