const { cmd } = require("../command");
const axios = require("axios");

const API_KEY = "darknero";
const SEARCH_API = "https://apis.sandarux.sbs/api/download/xnxx-search";
const DL_API = "https://apis.sandarux.sbs/api/download/xnxx-dl";

// තාවකාලිකව සර්ච් රිසල්ට් මතක තබා ගැනීමට
const xnxxData = new Map();

cmd({
    pattern: "xnxx",
    alias: ["porn", "xvideo"],
    react: "🔞",
    desc: "Search and download XNXX videos with Direct Stream Logic",
    category: "download",
    filename: __filename
}, async (bot, mek, m, { from, q, reply }) => {
    try {
        // --- 1. වීඩියෝව ලබා ගැනීම (Reply Logic) ---
        if (m.quoted && xnxxData.has(from + m.quoted.stanzaId)) {
            const results = xnxxData.get(from + m.quoted.stanzaId);
            const index = parseInt(q) - 1;
            const selectedVideo = results[index];

            if (!selectedVideo) return reply("⚠️ වැරදි අංකයකි. කරුණාකර ලැයිස්තුවේ ඇති අංකයක් ලබා දෙන්න.");

            await bot.sendMessage(from, { react: { text: '⏳', key: m.key } });

            // ඩවුන්ලෝඩ් ලින්ක් එක ලබා ගැනීම
            const dlRes = await axios.get(`${DL_API}?apikey=${API_KEY}&url=${selectedVideo.url}`);
            
            if (!dlRes.data.status || !dlRes.data.links) {
                return reply("❌ වීඩියෝ ලින්ක් එක ලබා ගැනීමට නොහැකි විය.");
            }

            const finalUrl = dlRes.data.links.high || dlRes.data.links.low;
            const videoTitle = selectedVideo.title || "XNXX Video";

            // [DIRECT STREAM METHOD]
            // Gifted-Baileys හරහා URL එක කෙලින්ම යවනවා. RAM එක පාවිච්චි වෙන්නේ නැත.
            await bot.sendMessage(from, { 
                document: { url: finalUrl }, 
                mimetype: 'video/mp4', 
                fileName: `[ZANTA-MD] ${videoTitle}.mp4`,
                caption: `🎬 *${videoTitle}*\n\n> *© ZANTA-MD XNXX SERVICE*`
            }, { quoted: m });

            await bot.sendMessage(from, { react: { text: '✅', key: m.key } });
            return;
        }

        // --- 2. සර්ච් කිරීම ---
        if (!q) return reply("🔞 *ZANTA XNXX SEARCH*\n\nExample: .xnxx blue film");

        const searchRes = await axios.get(`${SEARCH_API}?apikey=${API_KEY}&q=${encodeURIComponent(q)}`);
        
        // API Response එකේ 'data' array එක තිබේදැයි බැලීම
        if (!searchRes.data.status || !searchRes.data.data || searchRes.data.data.length === 0) {
            return reply("❌ කිසිදු ප්‍රතිඵලයක් හමු නොවීය.");
        }

        const results = searchRes.data.data.slice(0, 10); // මුල් 10 ගමු
        let msg = `🔞 *ZANTA XNXX SEARCH* 🔞\n\n🔍 Query: *${q}*\n\n`;
        
        results.forEach((res, index) => {
            msg += `${index + 1}️⃣ *${res.title}*\n`;
        });
        
        msg += `\n> *Reply with the number to download.* \n\n*© ZANTA-MD*`;

        const sentSearch = await bot.sendMessage(from, { 
            text: msg 
        }, { quoted: mek });

        // සර්ච් රිසල්ට් එක Map එකේ සේව් කිරීම (රිප්ලයි එක හඳුනා ගැනීමට)
        xnxxData.set(from + sentSearch.key.id, results);

        // පැයකට පසු Map එකෙන් දත්ත ඉවත් කිරීම (RAM Cleanup)
        setTimeout(() => {
            xnxxData.delete(from + sentSearch.key.id);
        }, 3600000);

    } catch (e) {
        console.error("XNXX Error:", e);
        reply("❌ දෝෂයක් සිදු විය: " + e.message);
    }
});
