const { cmd } = require("../command");
const axios = require("axios");

cmd({
    pattern: "ss",
    alias: ["screenshot", "webss"],
    react: "📸",
    desc: "Take a screenshot of a website.",
    category: "tools",
    filename: __filename
}, async (bot, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("📸 *කරුණාකර Screenshot එකක් ගැනීමට වෙබ් අඩවියේ ලින්ක් එක ලබා දෙන්න!*\n\nExample: .ss https://google.com");

        // URL එක නිවැරදිදැයි බැලීම (Http/Https නැතිනම් එකතු කිරීම)
        let url = q.startsWith("http") ? q : "https://" + q;

        await bot.sendMessage(from, { react: { text: "⏳", key: m.key } });

        const API_URL = `https://apis.sandarux.sbs/api/tools/ssweb?apikey=darknero&url=${encodeURIComponent(url)}`;

        // API එකෙන් Screenshot එක Buffer එකක් විදියට ලබා ගැනීම
        const response = await axios.get(API_URL, {
            responseType: "arraybuffer",
            timeout: 60000 // විනාඩියක timeout එකක් (වෙබ් සයිට් එක load වෙන්න වෙලාව යන නිසා)
        });

        const ssBuffer = Buffer.from(response.data);

        // Screenshot එක යැවීම
        await bot.sendMessage(from, {
            image: ssBuffer,
            caption: `📸 *WEBSITE SCREENSHOT*\n\n🌐 *URL:* ${url}\n\n> *© ZANTA-MD TOOLS SERVICE*`
        }, { quoted: mek });

        await bot.sendMessage(from, { react: { text: "✅", key: m.key } });

    } catch (e) {
        console.error("SS Error:", e);
        await bot.sendMessage(from, { react: { text: "❌", key: m.key } });
        
        let errorMsg = "❌ *Screenshot එක ලබා ගැනීමට නොහැකි විය.*";
        if (e.code === 'ECONNABORTED') errorMsg = "❌ *Request timed out.*";
        
        reply(errorMsg + "\nකරුණාකර URL එක නිවැරදිදැයි පරීක්ෂා කර නැවත උත්සාහ කරන්න.");
    }
});
