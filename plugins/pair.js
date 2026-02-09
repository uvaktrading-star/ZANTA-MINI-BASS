const { cmd } = require("../command");
const axios = require("axios");

const CHANNEL_JID = "120363406265537739@newsletter";

cmd({
    pattern: "pair",
    alias: ["code", "login"],
    react: "🔑",
    desc: "Get ZANTA-MD pair code with a pro look.",
    category: "main",
    filename: __filename
}, async (bot, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("ℹ️ *Please provide your phone number with country code.*\n\n*Example:* `.pair 94743404814` ");

        let phoneNumber = q.replace(/[^0-9]/g, '');
        await bot.sendMessage(from, { react: { text: '⏳', key: mek.key } });

        // 1. මුලින්ම පණිවිඩය යවනවා
        const wait = await bot.sendMessage(from, { 
            text: "🔍 *𝚉𝙰𝙽𝚃𝙰-𝙼𝙳 𝙸𝚂 𝙶𝙴𝙽𝙴𝚁𝙰𝚃𝙸𝙽𝙶 𝚈𝙾𝚄𝚁 𝙲𝙾𝙳𝙴...* ⚡" 
        }, { quoted: mek });

        const pairUrl = `https://zanta-mini-pair.onrender.com/code?number=${phoneNumber}`;
        const response = await axios.get(pairUrl);

        if (response.data && response.data.code) {
            const pairCode = response.data.code;

            // 2. යවන ලද පණිවිඩය EDIT කිරීම
            await bot.sendMessage(from, { 
                text: "✅ *𝙲𝙾𝙳𝙴 𝙶𝙴𝙽𝙴𝚁𝙰𝚃𝙴𝙳 𝚂𝚄𝙲𝙲𝙴𝚂𝚂𝙵𝚄𝙻𝙻𝚈!*", 
                edit: wait.key 
            });

            // Newsletter Context Info
            const contextInfo = {
                forwardingScore: 999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: CHANNEL_JID,
                    serverMessageId: 100,
                    newsletterName: "𝒁𝑨𝑵𝑻𝑨-𝑴𝑫 𝑶𝑭𝑭𝑰𝑪𝑰𝑨𝑳 </>"
                }
            };

            // 3. ප්‍රධාන විස්තර මැසේජ් එක (ASCII Art සහිතව)
            let mainMsg =  `✨ *𝚉𝙰𝙽𝚃𝙰-𝙼𝙳 𝙿𝙰𝙸𝚁 𝚂𝙴𝚁𝚅𝙸𝙲𝙴* ✨ \n\n` +
                          `👤 *𝙽𝚞𝚖𝚋𝚎𝚛:* ${phoneNumber}\n` +
                          `📟 *𝚂𝚝𝚊𝚝𝚞𝚜:* 𝚂𝚞𝚌𝚌𝚎𝚜𝚜𝚏𝚞𝚕\n\n` +
                          `📝 *𝙸𝙽𝚂𝚃𝚁𝚄𝙲𝚃𝙸𝙾𝙽𝚂:* \n` +
                          `𝟷. 𝙲𝚘𝚙𝚢 𝚝𝚑𝚎 𝚌𝚘𝚍𝚎 𝚜𝚎𝚗𝚝 𝚋𝚎𝚕𝚘𝚠.\n` +
                          `𝟸. 𝙾𝚙𝚎𝚗 𝚆𝚑𝚊𝚝𝚜𝙰𝚙𝚙 > 𝙻𝚒𝚗𝚔𝚎𝚍 𝙳𝚎𝚟𝚒𝚌𝚎𝚜.\n` +
                          `𝟹. 𝚂𝚎𝚕𝚎𝚌𝚝 '𝙻𝚒𝚗𝚔 𝚠𝚒𝚝𝚑 𝚙𝚑𝚘𝚗𝚎 𝚗𝚞𝚖𝚋𝚎𝚛'.\n` +
                          `𝟺. 𝙿𝚊𝚜𝚝𝚎 𝚝𝚑𝚎 𝚌𝚘𝚍𝚎 𝚝𝚑𝚎𝚛𝚎.\n\n` +
                          `> *© 𝚉𝙰𝙽𝚃𝙰-𝙼𝙳 𝙼𝚄𝙻𝚃𝙸 𝙳𝙴𝚅𝙸𝙲𝙴 𝙱𝙾𝚃*`;

            await bot.sendMessage(from, { 
                text: mainMsg, 
                contextInfo: contextInfo 
            }, { quoted: mek });

            // 4. Pair Code එක විතරක් Copy-Paste කිරීමට පහසු ලෙස යැවීම
            await bot.sendMessage(from, { 
                text: `${pairCode}`,
            }, { quoted: mek });

            await bot.sendMessage(from, { react: { text: '✅', key: mek.key } });

        } else {
            reply("❌ *Failed to generate code.* Server might be down.");
        }

        if (global.gc) global.gc();

    } catch (e) {
        console.error(e);
        reply("❌ *Error:* සයිට් එක සම්බන්ධ කරගත නොහැක. (Render site might be sleeping)");
    }
});
