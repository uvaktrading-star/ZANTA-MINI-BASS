const { cmd } = require("../command");
const axios = require("axios");

const API_KEY = "darknero";
const SEARCH_API = "https://apis.sandarux.sbs/api/download/xnxx-search";
const DL_API = "https://apis.sandarux.sbs/api/download/xnxx-dl";
const LOGO_URL = "https://github.com/Akashkavindu/ZANTA_MD/blob/main/images/zanta-md.png?raw=true";

cmd({
    pattern: "xnxx",
    alias: ["porn", "xvideo"],
    react: "🔞",
    desc: "Search and download XNXX videos with Real-time Reply Logic.",
    category: "download",
    filename: __filename
}, async (bot, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("🔞 *ZANTA XNXX SEARCH*\n\nExample: .xnxx blue film");

        // --- 1. සර්ච් කිරීම ---
        const searchRes = await axios.get(`${SEARCH_API}?apikey=${API_KEY}&q=${encodeURIComponent(q)}`).catch(() => null);
        
        if (!searchRes || !searchRes.data.status || !searchRes.data.data || searchRes.data.data.length === 0) {
            return reply("❌ කිසිදු ප්‍රතිඵලයක් හමු නොවීය.");
        }

        const results = searchRes.data.data.slice(0, 10);
        let msg = `🔞 *ZANTA XNXX SEARCH* 🔞\n\n🔍 Query: *${q}*\n\n`;
        
        results.forEach((res, index) => {
            msg += `${index + 1}️⃣ *${res.title}*\n`;
        });
        msg += `\n> *Reply with the number to download.* \n\n*© ZANTA-MD*`;

        const sentMsg = await bot.sendMessage(from, { 
            image: { url: LOGO_URL }, 
            caption: msg 
        }, { quoted: mek });

        // --- 2. Reply Listener එක (song.js එකේ වගේමයි) ---
        const xnxxListener = async (update) => {
            try {
                const msgUpdate = update.messages[0];
                if (!msgUpdate.message) return;

                const body = msgUpdate.message.conversation || msgUpdate.message.extendedTextMessage?.text;
                const isReplyToBot = msgUpdate.message.extendedTextMessage?.contextInfo?.stanzaId === sentMsg.key.id;

                if (isReplyToBot && !isNaN(body)) {
                    const index = parseInt(body) - 1;
                    const selectedVideo = results[index];

                    if (selectedVideo) {
                        // වැඩේ පටන් ගත්ත ගමන් Listener එක ඕෆ් කරනවා (දෙපාරක් නොවෙන්න)
                        bot.ev.off('messages.upsert', xnxxListener);
                        
                        await bot.sendMessage(from, { react: { text: '⏳', key: msgUpdate.key } });

                        // --- 3. ඩවුන්ලෝඩ් ලින්ක් එක ගැනීම ---
                        const dlRes = await axios.get(`${DL_API}?apikey=${API_KEY}&url=${selectedVideo.url}`).catch(() => null);
                        
                        if (!dlRes || !dlRes.data.status || !dlRes.data.links) {
                            return reply("❌ වීඩියෝ ලින්ක් එක ලබා ගැනීමට නොහැකි විය.");
                        }

                        const finalUrl = dlRes.data.links.high || dlRes.data.links.low;
                        const videoTitle = selectedVideo.title || "XNXX Video";

                        // --- 4. Direct Stream Method (Baileys) ---
                        await bot.sendMessage(from, { 
                            document: { url: finalUrl }, 
                            mimetype: 'video/mp4', 
                            fileName: `[ZANTA-MD] ${videoTitle}.mp4`,
                            caption: `🎬 *${videoTitle}*\n\n> *© ZANTA-MD XNXX SERVICE*`
                        }, { quoted: msgUpdate });

                        await bot.sendMessage(from, { react: { text: '✅', key: msgUpdate.key } });
                    }
                }
            } catch (err) {
                console.error("XNXX Listener Error:", err);
            }
        };

        // Listener එක Register කිරීම
        bot.ev.on('messages.upsert', xnxxListener);

        // විනාඩි 5කට පසු රිප්ලයි එකක් නැත්නම් ඉබේම Listener එක නතර කරන්න
        setTimeout(() => {
            bot.ev.off('messages.upsert', xnxxListener);
        }, 300000);

    } catch (e) {
        console.error("Main Command Error:", e);
        reply("❌ දෝෂයක් සිදු විය: " + e.message);
    }
});
