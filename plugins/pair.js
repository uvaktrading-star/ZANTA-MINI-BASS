const { cmd } = require("../command");
const axios = require("axios");

cmd({
    pattern: "pair",
    alias: ["code", "login"],
    react: "🔑",
    desc: "Get ZANTA-MD pair code.",
    category: "main",
    filename: __filename
}, async (bot, mek, m, { from, q, reply }) => {
    try {
        // අංකය ඇතුළත් කර ඇත්දැයි බැලීම
        if (!q) return reply("ℹ️ *Please provide your phone number with country code.*\n\n*Example:* `.pair 94743404814` ");

        // Number එක විතරක් clean කරගැනීම
        let phoneNumber = q.replace(/[^0-9]/g, '');

        await bot.sendMessage(from, { react: { text: '⏳', key: mek.key } });
        const wait = await reply("Please wait... Generating your ZANTA-MD Pair Code... ⚡");

        // --- ඔයාගේ Site එකේ API Endpoint එක ---
        // Render සයිට් වල සාමාන්‍යයෙන් endpoint එක වෙන්නේ /code?number=
        const pairUrl = `https://zanta-mini-pair.onrender.com/code?number=${phoneNumber}`;

        const response = await axios.get(pairUrl);

        // සයිට් එකෙන් එන response එක පරීක්ෂා කිරීම
        if (response.data && response.data.code) {
            const pairCode = response.data.code;

            let msg = `✅ *ZANTA-MD PAIR CODE* ✅\n\n`;
            msg += `📟 *Code:* ${pairCode}\n`;
            msg += `📱 *Number:* ${phoneNumber}\n\n`;
            msg += `> *Copy the code and link your WhatsApp within 2 minutes.* \n\n*© ZANTA-MD*`;

            await bot.sendMessage(from, { text: msg }, { quoted: mek });
            
            // Reaction එක update කිරීම සහ wait message එක මැකීම
            await bot.sendMessage(from, { delete: wait.key });
            await bot.sendMessage(from, { react: { text: '✅', key: mek.key } });

        } else {
            reply("❌ *Failed to generate code.* සයිට් එකේ මොනයම් හෝ දෝෂයක් පවතී. පසුව උත්සාහ කරන්න.");
        }

        // RAM එක Clean කිරීම
        if (global.gc) global.gc();

    } catch (e) {
        console.error(e);
        reply("❌ *Error:* සයිට් එක සම්බන්ධ කරගත නොහැක. (Render සයිට් එක Sleep වී තිබිය හැක, විනාඩියකින් උත්සාහ කරන්න)");
    }
});
