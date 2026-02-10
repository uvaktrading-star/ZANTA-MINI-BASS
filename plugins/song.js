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
    desc: "Search and download XNXX videos with Selection Menu",
    category: "download",
    filename: __filename,
}, async (bot, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("🔞 *ZANTA-MD XNXX SEARCH*\n\nExample: .xnxx blue film");

        // 1. සර්ච් කිරීම
        const searchRes = await axios.get(`${SEARCH_API}?apikey=${API_KEY}&q=${encodeURIComponent(q)}`);
        
        if (!searchRes.data.status || !searchRes.data.data || searchRes.data.data.length === 0) {
            return reply("❌ කිසිදු ප්‍රතිඵලයක් හමු නොවීය.");
        }

        const results = searchRes.data.data.slice(0, 10); // මුල් 10 ගමු
        let msg = `🔞 *ZANTA XNXX SEARCH* 🔞\n\n🔍 Query: *${q}*\n\n`;
        
        results.forEach((res, index) => {
            msg += `${index + 1}️⃣ *${res.title}*\n`;
        });
        
        msg += `\n> *Reply with the number to download.* \n\n*© ZANTA-MD*`;

        const sentMsg = await bot.sendMessage(from, { 
            image: { url: LOGO_URL }, 
            caption: msg 
        }, { quoted: mek });

        // --- Reply Listener එක ආරම්භය ---
        const listener = async (update) => {
            const msgUpdate = update.messages[0];
            if (!msgUpdate.message) return;

            const body = msgUpdate.message.conversation || 
                         msgUpdate.message.extendedTextMessage?.text;

            const isReplyToBot = msgUpdate.message.extendedTextMessage?.contextInfo?.stanzaId === sentMsg.key.id;

            if (isReplyToBot) {
                const index = parseInt(body) - 1;
                if (isNaN(index) || index < 0 || index >= results.length) return; // අංකය වැරදි නම් ignore කරන්න

                await bot.sendMessage(from, { react: { text: '⏳', key: msgUpdate.key } });

                try {
                    const selectedVideo = results[index];
                    const dlRes = await axios.get(`${DL_API}?apikey=${API_KEY}&url=${selectedVideo.url}`);
                    
                    if (!dlRes.data.status || !dlRes.data.links) {
                        return reply("❌ වීඩියෝ ලින්ක් එක ලබා ගැනීමට නොහැකි විය.");
                    }

                    const finalUrl = dlRes.data.links.high || dlRes.data.links.low;
                    const videoTitle = selectedVideo.title || "XNXX Video";

                    // වීඩියෝව Document එකක් ලෙස යැවීම (RAM එකට බරක් නැත)
                    await bot.sendMessage(from, { 
                        document: { url: finalUrl }, 
                        mimetype: 'video/mp4', 
                        fileName: `[ZANTA-MD] ${videoTitle}.mp4`,
                        caption: `🎬 *${videoTitle}*\n\n> *© ZANTA-MD XNXX SERVICE*`
                    }, { quoted: msgUpdate });

                    await bot.sendMessage(from, { react: { text: '✅', key: msgUpdate.key } });

                } catch (err) {
                    console.error(err);
                    reply("❌ වීඩියෝව ලබා ගැනීමේදී දෝෂයක් සිදු විය.");
                }

                // වැඩේ ඉවර වුණාම Listener එක අයින් කරන්න
                bot.ev.off('messages.upsert', listener);
            }
        };

        bot.ev.on('messages.upsert', listener);

        // විනාඩි 5කට පසු Listener එක ඉවත් කිරීම
        setTimeout(() => {
            bot.ev.off('messages.upsert', listener);
        }, 300000);

    } catch (e) {
        console.error("XNXX ERROR:", e);
        reply("❌ *Error:* " + e.message);
    }
});
