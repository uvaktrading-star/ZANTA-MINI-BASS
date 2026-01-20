const { cmd, commands } = require("../command");
const os = require('os');
const config = require("../config");
const { sendButtons } = require("gifted-btns");

const MENU_IMAGE_URL = "https://github.com/Akashkavindu/ZANTA_MD/blob/main/images/Gemini_Generated_Image_4xcl2e4xcl2e4xcl.png?raw=true";
const CHANNEL_JID = "120363406265537739@newsletter"; 
const lastMenuMessage = new Map();

cmd({
    pattern: "menu",
    react: "📜",
    desc: "Displays the main menu or a category list.",
    category: "main",
    filename: __filename,
},
async (zanta, mek, m, { from, reply, args, userSettings }) => {
    try {
        const settings = userSettings || global.CURRENT_BOT_SETTINGS || {};
        const finalPrefix = settings.prefix || config.DEFAULT_PREFIX || '.'; 
        const botName = settings.botName || config.DEFAULT_BOT_NAME || "ZANTA-MD"; 
        const ownerName = settings.ownerName || config.DEFAULT_OWNER_NAME || 'Akash Kavindu';
        const mode = (settings.workType || "Public").toUpperCase();
        const isButtonsOn = settings.buttons === 'true';

        let inputBody = m.body ? m.body.trim().toLowerCase() : "";

        // --- 🛡️ IMPROVED SELECTION GUARD ---
        const isNumber = /^\d+$/.test(inputBody); 
        const isCategorySelection = inputBody.startsWith('cat_');
        const isMainCmd = (inputBody === `${finalPrefix}menu` || inputBody === "menu");

        // 1. මේ තුනෙන් එකක්වත් නෙවෙයි නම් මේ ප්ලගින් එකෙන් කිසිම දෙයක් කරන්නේ නැහැ
        if (!isNumber && !isCategorySelection && !isMainCmd) {
            return;
        }

        // 2. අංකයක් එව්වොත්, ඒක අනිවාර්යයෙන්ම මෙනු මැසේජ් එකකට රිප්ලයි එකක් වෙන්න ඕනේ
        if (isNumber && !isMainCmd) {
            if (!m.quoted || lastMenuMessage.get(from) !== m.quoted.id) {
                return; // වෙන මැසේජ් එකකට අංකයක් රිප්ලයි කළොත් මෙනු එක ඕපන් වෙන්නේ නැහැ
            }
        }
        // ------------------------------------

        const totalCommands = commands.filter(c => c.pattern).length;
        const groupedCommands = {};
        const customOrder = ["main", "download", "tools", "logo"];

        commands.filter(c => c.pattern && c.pattern !== "menu").forEach(cmdData => {
            let cat = cmdData.category?.toLowerCase() || "other";
            if (cat === "genaral") cat = "other"; 
            if (!groupedCommands[cat]) groupedCommands[cat] = [];
            groupedCommands[cat].push(cmdData);
        });

        const categoryKeys = Object.keys(groupedCommands).sort((a, b) => {
            let indexA = customOrder.indexOf(a);
            let indexB = customOrder.indexOf(b);
            if (indexA === -1) indexA = 99;
            if (indexB === -1) indexB = 99;
            return indexA - indexB;
        });

        const categoryMap = {}; 
        categoryKeys.forEach((cat, index) => { categoryMap[index + 1] = cat; });

        let selectedCategory;

        if (isCategorySelection) {
            selectedCategory = inputBody.replace('cat_', '');
        } else if (isNumber) {
            selectedCategory = categoryMap[parseInt(inputBody)];
        }

        // --- 📄 SUB MENU DISPLAY ---
        if (selectedCategory && groupedCommands[selectedCategory]) {
            let displayTitle = selectedCategory.toUpperCase() === 'OTHER' ? 'GENERAL' : selectedCategory.toUpperCase();
            let emoji = { main: '🏠', download: '📥', tools: '🛠', owner: '👑', logo: '🎨' }[selectedCategory.toLowerCase()] || '📌';

            let commandList = `╭━━〔 ${emoji} ${displayTitle} 〕━━┈⊷\n`;
            commandList += `┃★╭──────────────·๏\n┃★│ 📝 Category : ${displayTitle}\n┃★│ 📊 Available : ${groupedCommands[selectedCategory].length}\n┃★╰──────────────·๏\n╰━━━━━━━━━━━━━━┈⊷\n\n`;
            commandList += `╭━━〔 💻 COMMANDS 〕━━┈⊷\n`;
            groupedCommands[selectedCategory].forEach((c) => {
                commandList += `┃ ◈ ⚡ ${finalPrefix}${c.pattern}\n`;
            });
            commandList += `╰━━━━━━━━━━━━━━┈⊷\n\n> *©POWERED BY ${botName}*`;

            return await zanta.sendMessage(from, { 
                text: commandList,
                contextInfo: {
                    forwardingScore: 999,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: CHANNEL_JID,
                        serverMessageId: 100,
                        newsletterName: "𝒁𝑨𝑵𝑻𝑨-𝑴𝑫 𝑶𝑭𝑭𝑰𝑪𝑰𝑨𝑳 </>"
                    }
                }
            }, { quoted: mek }); 
        }

        // --- 🏠 MAIN MENU DISPLAY ---
        let headerText = `╭━〔 ${botName} WA BOT 〕━··๏\n`;
        headerText += `┃★╭──────────────\n┃★│ 👑 Owner : ${ownerName}\n┃★│ ⚙ Mode : [${mode}]\n┃★│ 🔣 Prefix : [${finalPrefix}]\n┃★│ 📚 Commands : ${totalCommands}\n┃★╰──────────────\n╰━━━━━━━━━━━━━━┈⊷\n\n`;

        if (isButtonsOn) {
            await zanta.sendMessage(from, { image: { url: MENU_IMAGE_URL } }, { quoted: mek });
            const buttons = [
                { id: "cat_main", text: "🏠 Main" },
                { id: "cat_download", text: "📥 Download" },
                { id: "cat_tools", text: "🛠 Tools" },
                { id: "cat_logo", text: "🎨 Logo" }
            ];
            await sendButtons(zanta, from, {
                text: headerText + "> ꜱᴇʟᴇᴄᴛ ᴀ ᴄᴀᴛᴇɢۆʀʏ ʙᴇʟۆᴡ 👇",
                footer: `© ${botName} • Buttons Mode`,
                buttons: buttons
            });
        } else {
            let menuText = headerText;
            menuText += `╭━━〔 📜 MENU LIST 〕━━┈⊷\n`;
            categoryKeys.forEach((catKey, index) => {
                const count = groupedCommands[catKey].length;
                let title = catKey.toUpperCase() === 'OTHER' ? 'GENERAL' : catKey.toUpperCase();
                let emoji = { main: '🏠', download: '📥', tools: '🛠', logo: '🎨' }[catKey] || '📌';
                menuText += `┃◈╭─────────────·๏\n┃◈│ ${index + 1}. ${emoji} ${title} (${count})\n┃◈╰───────────┈⊷\n`;
            });
            menuText += `╰──────────────┈⊷\n\n_💡 Reply කර අංකය යවන්න._`;

            const sentMessage = await zanta.sendMessage(from, {
                image: { url: MENU_IMAGE_URL },
                caption: menuText.trim()
            }, { quoted: mek });

            // වැදගත්: මෙතන තමයි අයිඩි එක සේව් කරන්නේ රිප්ලයි චෙක් කරන්න
            lastMenuMessage.set(from, sentMessage.key.id);
        }

    } catch (err) {
        console.error("Menu Error:", err);
        reply("❌ Error generating menu.");
    }
});

module.exports = { lastMenuMessage };

