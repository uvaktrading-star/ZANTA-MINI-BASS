const { cmd } = require("../command");
const axios = require("axios");

const CHANNEL_JID = "120363406265537739@newsletter";
const cooldowns = new Map();

cmd({
    pattern: "pair",
    alias: ["code", "login"],
    react: "🔑",
    desc: "Get ZANTA-MD pair code.",
    category: "main",
    filename: __filename
}, async (bot, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("ℹ️ *Please provide your phone number with country code.*");

        let phoneNumber = q.replace(/[^0-9]/g, '');
        
        // Cooldown Check
        if (cooldowns.has(phoneNumber)) {
            return reply("⏳ *Please wait!* You already requested a code.");
        }

        await bot.sendMessage(from, { react: { text: '⏳', key: mek.key } });
        const wait = await bot.sendMessage(from, { text: "🔍 *𝚉𝙰𝙽𝚃𝙰-𝙼𝙳 𝙸𝚂 𝙶𝙴𝙽𝙴𝚁𝙰𝚃𝙸𝙽𝙶...*" });

        // Cooldown Set
        cooldowns.set(phoneNumber, Date.now());
        setTimeout(() => cooldowns.delete(phoneNumber), 40000); 

        const pairUrl = `https://zanta-mini-pair.onrender.com/code?number=${phoneNumber}`;

        // --- [FIX: Preventing multiple requests] ---
        const response = await axios.get(pairUrl, { 
            timeout: 30000, // Render නිසා timeout එක වැඩි කරා
            headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'Expires': '0',
            }
        });

        if (response.data && response.data.code) {
            const pairCode = response.data.code;

            await bot.sendMessage(from, { text: "✅ *𝙲𝙾𝙳𝙴 𝙶𝙴𝙽𝙴𝚁𝙰𝚃𝙴𝙳!*", edit: wait.key });

            const contextInfo = {
                forwardingScore: 999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: CHANNEL_JID,
                    serverMessageId: 100,
                    newsletterName: "𝒁𝑨𝑵𝑻𝑨-𝑴𝑫 𝑶𝑭𝑭𝑰𝑪𝑰𝑨𝑳 </>"
                }
            };

            let mainMsg = `✨ *𝚉𝙰𝙽𝚃𝙰-𝙼𝙳 𝙿𝙰𝙸𝚁 𝚂𝙴𝚁𝚅𝙸𝙲𝙴* ✨ \n\n` +
                          `👤 *𝙽𝚞𝚖𝚋𝚎𝚛:* ${phoneNumber}\n\n` +
                          `𝟷. 𝙲𝚘𝚙𝚢 𝚝𝚑𝚎 𝚌𝚘𝚍𝚎 𝚋𝚎𝚕𝚘𝚠.\n` +
                          `𝟸. 𝙿𝚊𝚜𝚝𝚎 𝚒𝚝 𝚘𝚗 𝚢𝚘𝚞𝚛 𝚠𝚑𝚊𝚝𝚜𝚊𝚙𝚙.\n\n` +
                          `> *© 𝚉𝙰𝙽𝑻𝑨-𝑴𝑫*`;

            await bot.sendMessage(from, { text: mainMsg, contextInfo: contextInfo }, { quoted: mek });
            await bot.sendMessage(from, { text: `${pairCode}` }, { quoted: mek });
            await bot.sendMessage(from, { react: { text: '✅', key: mek.key } });

        } else {
            throw new Error("Invalid response");
        }

    } catch (e) {
        cooldowns.delete(q.replace(/[^0-9]/g, ''));
        console.error("Pair Error:", e.message);
        reply("❌ *Error:* සර්වර් එකෙන් කෝඩ් එක ලබාගත නොහැකි විය. (Site might be down)");
    }
});
