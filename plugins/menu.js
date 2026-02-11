const { cmd, commands } = require("../command");
const os = require('os');
const config = require("../config");
const axios = require('axios'); 

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
    desc: "Displays the main menu or a category list.",
    category: "main",
    filename: __filename,
},
async (zanta, mek, m, { from, reply, args, userSettings, prefix }) => {
    try {
        const settings = userSettings || global.CURRENT_BOT_SETTINGS || {};
        const finalPrefix = prefix || settings.prefix || '.'; 
        const botName = settings.botName || "𝐙𝐀𝐍𝐓𝐀-𝐌𝐃"; 
        const ownerName = settings.ownerName || 'Akash Kavindu';
        const mode = (settings.workType || "Public").toUpperCase();

        let inputBody = m.body ? m.body.trim().toLowerCase() : "";
        const isNumber = /^\d+$/.test(inputBody); 
        
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

        const contextInfo = {
            forwardingScore: 999,
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
                newsletterJid: CHANNEL_JID,
                serverMessageId: 100,
                newsletterName: "𝒁𝑨𝑵𝑻𝑨-𝑴𝑫 𝑶𝑭𝑭𝑰𝑪𝑰𝑨𝑳 </>"
            }
        };

        let imageToDisplay = cachedMenuImage || { url: MENU_IMAGE_URL };

        // --- 📂 CATEGORY SELECTION (REPLY LOGIC) ---
        if (isNumber && m.quoted && lastMenuMessage.get(from) === m.quoted.id) {
            const selectedCategory = categoryMap[parseInt(inputBody)];
            
            if (selectedCategory && groupedCommands[selectedCategory]) {
                let displayTitle = selectedCategory.toUpperCase();
                let emoji = { main: '🏠', download: '📥', tools: '🛠️', logo: '🎨', media: '🖼️' }[selectedCategory.toLowerCase()] || '📌';

                let commandList = `✨ *${botName} ${displayTitle} ⚡*\n\n`;
                commandList += `┌───⊷ *${emoji} 𝕀ℕ𝔽𝕆* ⊷───\n`;
                commandList += `│ 📂 *𝐂𝐚𝐭𝐞𝐠𝐨𝐫𝐲:* ${displayTitle}\n`;
                commandList += `│ 📊 *𝐓𝐨𝐭𝐚𝐥:* ${groupedCommands[selectedCategory].length}\n`;
                commandList += `└──────────────┈⊷\n\n`;

                groupedCommands[selectedCategory].forEach((c) => {
                    commandList += `  ◦  *${finalPrefix}${c.pattern}*\n`;
                });
                
                commandList += `\n> *© ${botName} 𝕊𝕖𝕣𝕧𝕚𝕔𝕖*`;

                return await zanta.sendMessage(from, { text: commandList, contextInfo }, { quoted: mek }); 
            }
        }

        // --- 📜 MAIN MENU TEXT (ASCII & STYLE) ---
        let menuText = `👋 ℍ𝕖𝕝𝕝𝕠 ${m.pushName || 'User'},\n\n`;
        menuText += `*╔═════ ${botName} ═════╗*\n`;
        menuText += `*║* 👤 *𝐎𝐰𝐧𝐞𝐫 :* ${ownerName}\n`;
        menuText += `*║* ⚙️ *𝐌𝐨𝐝𝐞 :* ${mode}\n`;
        menuText += `*║* 🔣 *𝐏𝐫𝐞𝐟𝐢𝐱 :* ${finalPrefix}\n`;
        menuText += `*║* 📚 *𝐂𝐦𝐝𝐬 :* ${commands.length}\n`;
        menuText += `*╚══════════════════╝*\n\n`;
        
        menuText += `┌───⊷ *📑 𝕃𝕀𝕊𝕋𝕊* ⊷───\n`;
        categoryKeys.forEach((catKey, index) => {
            let title = catKey.charAt(0).toUpperCase() + catKey.slice(1);
            let emoji = { main: '🏠', download: '📥', tools: '🛠️', logo: '🎨', media: '🖼️' }[catKey] || '📌';
            menuText += `│ *${index + 1}* ◦ ${emoji} *${title}*\n`;
        });
        menuText += `└──────────────┈⊷\n\n`;
        
        menuText += `_💡 Reply with a number to view commands._\n\n`;
        menuText += `> *© ${botName} • 𝟚𝟘𝟚𝟞*`;

        const sent = await zanta.sendMessage(from, {
            image: imageToDisplay,
            caption: menuText,
            contextInfo
        }, { quoted: mek });

        lastMenuMessage.set(from, sent.key.id);
        setTimeout(() => lastMenuMessage.delete(from), 15 * 60 * 1000);

    } catch (err) {
        console.error("Menu Error:", err);
        reply("❌ Error generating menu.");
    }
});

module.exports = { lastMenuMessage };
