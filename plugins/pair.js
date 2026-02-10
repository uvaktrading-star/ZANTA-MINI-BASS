const { cmd } = require("../command");
const axios = require("axios");

const CHANNEL_JID = "120363406265537739@newsletter";
const cooldowns = new Map(); // එකම අංකයට නැවත නැවත රික්වෙස්ට් යෑම වැලැක්වීමට

cmd({
    pattern: "pair",
    alias: ["code", "login"],
    react: "🔑",
    desc: "Get ZANTA-MD pair code.",
    category: "main",
    filename: __filename
}, async (bot, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("ℹ️ *Please provide your phone number with country code.*\n\n*Example:* `.pair 94743404814` ");

        let phoneNumber = q.replace(/[^0-9]/g, '');
        
        // --- [Cooldown Check] ---
        // එකම අංකයට තත්පර 30ක් ඇතුලත දෙපාරක් කෝඩ් ගන්න බැරි කරනවා
        if (cooldowns.has(phoneNumber)) {
            return reply("⏳ *Please wait a moment!* You already requested a code for this number.");
        }

        await bot.sendMessage(from, { react: { text: '⏳', key: mek.key } });

        const wait = await bot.sendMessage(from, { 
            text: "🔍 *𝚉𝙰𝙽𝚃𝙰-𝙼𝙳 𝙸𝚂 𝙶𝙴𝙽𝙴𝚁𝙰𝚃𝙸𝙽𝙶 𝚈𝙾𝚄𝚁 𝙲𝙾𝙳𝙴...* ⚡" 
        }, { quoted: mek });

        // Cooldown එක Set කිරීම
        cooldowns.set(phoneNumber, true);
        setTimeout(() => cooldowns.delete(phoneNumber), 30000); 

        const pairUrl = `https://zanta-mini-pair.onrender.com/code?number=${phoneNumber}`;
        
        // Axios එකට Timeout එකක් දානවා (වැදගත්ම කොටස)
        const response = await axios.get(pairUrl, { timeout: 20000 }); 

        if (response.data && response.data.code) {
            const pairCode = response.data.code;

            await bot.sendMessage(from, { 
                text: "✅ *𝙲𝙾𝙳𝙴 𝙶𝙴𝙽𝙴𝚁𝙰𝚃𝙴𝙳 𝚂𝚄𝙲𝙲𝙴𝚂𝚂𝙵𝚄𝙻𝙻𝚈!*", 
                edit: wait.key 
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

            let mainMsg = `✨ *𝚉𝙰𝙽𝚃𝙰-𝙼𝙳 𝙿𝙰𝙸𝚁 𝚂𝙴𝚁𝚅𝙸𝙲𝙴* ✨ \n\n` +
                          `👤 *𝙽𝚞𝚖𝚋𝚎𝚛:* ${phoneNumber}\n` +
                          `📟 *𝚂𝚝𝚊𝚝𝚞𝚜:* 𝚂𝚞𝚌𝚌𝚎𝚜𝚜𝚏𝚞𝚕\n\n` +
                          `📝 *𝙸𝙽𝚂𝚃𝚁𝚄𝙲𝚃𝙸𝙾𝙽𝚂:* \n` +
                          `𝟷. 𝙲𝚘𝚙𝚢 𝚝𝚑𝚎 𝚌𝚘𝚍𝚎 𝚜𝚎𝚗𝚝 𝚋𝚎𝚕𝚘𝚠.\n` +
                          `𝟿. 𝙿𝚊𝚜𝚝𝚎 𝚝𝚑𝚎 𝚌𝚘𝚍𝚎 𝚘𝚗 𝚢𝚘𝚞𝚛 𝚠𝚑𝚊𝚝𝚜𝚊𝚙𝚙.\n\n` +
                          `> *© 𝚉𝙰𝙽𝚃𝙰-𝙼𝙳 𝙼𝚄𝙻𝚃𝙸 𝙳𝙴𝚅𝙸𝙲𝙴 𝙱𝙾𝚃*`;

            await bot.sendMessage(from, { 
                text: mainMsg, 
                contextInfo: contextInfo 
            }, { quoted: mek });

            // Pair Code එක යැවීම
            await bot.sendMessage(from, { text: `${pairCode}` }, { quoted: mek });
            await bot.sendMessage(from, { react: { text: '✅', key: mek.key } });

        } else {
            cooldowns.delete(phoneNumber); // Fail වුණොත් cooldown අයින් කරනවා
            reply("❌ *Failed to generate code.* Server might be down.");
        }

    } catch (e) {
        console.error(e);
        cooldowns.delete(q.replace(/[^0-9]/g, ''));
        reply("❌ *Error:* සයිට් එක සම්බන්ධ කරගත නොහැක. (Render site might be sleeping)");
    }
});
