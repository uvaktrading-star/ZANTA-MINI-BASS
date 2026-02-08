const { cmd } = require("../command");
const axios = require("axios");

const API_KEY = "darknero";
const BASE_API = "https://apis.sandarux.sbs/api/movie";

cmd({
    pattern: "movie",
    alias: ["sinhalasub", "film", "cinema"],
    react: "🎬",
    desc: "Search and download movies from Sinhalasub.lk",
    category: "download",
    filename: __filename
}, async (bot, mek, m, { from, q, reply, sender }) => {
    try {
        if (!q) return reply("🎬 *ZANTA MOVIE SEARCH*\n\nExample: .movie Avengers");

        // 1. Search API call
        const searchRes = await axios.get(`${BASE_API}/sinhalasub-search?apikey=${API_KEY}&q=${encodeURIComponent(q)}`);
        
        if (!searchRes.data || !searchRes.data.results || searchRes.data.results.length === 0) {
            return reply("❌ No results found for your search.");
        }

        const results = searchRes.data.results.slice(0, 10);
        let msg = `🎬 *ZANTA MOVIE SEARCH* 🎬\n\n`;
        results.forEach((res, index) => {
            msg += `${index + 1}️⃣ *${res.title}*\n`;
        });
        msg += `\n*Reply with the number to see details.* \n\n> *© ZANTA-MD MOVIE SERVICE*`;

        const sentMsg = await bot.sendMessage(from, { 
            image: { url: results[0].thumbnail || "https://i.ibb.co/vz609p0/movie.jpg" }, 
            caption: msg 
        }, { quoted: mek });

        // --- Reply Listener ---
        const movieListener = async (update) => {
            const msgUpdate = update.messages[0];
            if (!msgUpdate.message) return;

            const body = msgUpdate.message.conversation || msgUpdate.message.extendedTextMessage?.text;
            const isReplyToBot = msgUpdate.message.extendedTextMessage?.contextInfo?.stanzaId === sentMsg.key.id;

            if (isReplyToBot && !isNaN(body)) {
                const index = parseInt(body) - 1;
                const selected = results[index];

                if (selected) {
                    // වැඩේ පටන් ගත්ත නිසා Listener එක අයින් කරනවා (අලුත් එකක් ඊළඟට දාන නිසා)
                    bot.ev.off('messages.upsert', movieListener);
                    await bot.sendMessage(from, { react: { text: '⏳', key: msgUpdate.key } });

                    try {
                        // 2. Info API call
                        const infoRes = await axios.get(`${BASE_API}/sinhalasub-info?apikey=${API_KEY}&url=${selected.link}`);
                        const data = infoRes.data.result;

                        let infoMsg = `🎬 *${data.title}* 🎬\n\n` +
                                     `📅 *Release:* ${data.release_date}\n` +
                                     `⭐ *IMDb:* ${data.imdb_rating}\n` +
                                     `🎭 *Genres:* ${data.genres}\n\n` +
                                     `*Select Download Quality:* \n\n`;

                        data.dl_links.forEach((dl, i) => {
                            infoMsg += `${i + 1}️⃣ ${dl.quality} (${dl.size})\n`;
                        });
                        infoMsg += `\n> *Reply with the number to get the file.*`;

                        const infoSent = await bot.sendMessage(from, { image: { url: data.image }, caption: infoMsg }, { quoted: msgUpdate });

                        // --- Quality Listener ---
                        const qualityListener = async (qUpdate) => {
                            const qMsg = qUpdate.messages[0];
                            const qBody = qMsg.message?.conversation || qMsg.message?.extendedTextMessage?.text;
                            const isReplyToInfo = qMsg.message?.extendedTextMessage?.contextInfo?.stanzaId === infoSent.key.id;

                            if (isReplyToInfo && !isNaN(qBody)) {
                                const qIndex = parseInt(qBody) - 1;
                                const selectedDl = data.dl_links[qIndex];

                                if (selectedDl) {
                                    bot.ev.off('messages.upsert', qualityListener);
                                    await bot.sendMessage(from, { react: { text: '⬇️', key: qMsg.key } });

                                    try {
                                        // 3. Download API call
                                        const dlRes = await axios.get(`${BASE_API}/sinhalasub-download?apikey=${API_KEY}&url=${selectedDl.link}`);
                                        const pixeldrainUrl = dlRes.data.result.pixeldrain_url;
                                        const fileId = pixeldrainUrl.split('/').pop();
                                        const directUrl = `https://pixeldrain.com/api/file/${fileId}?download`;

                                        await bot.sendMessage(from, { 
                                            document: { url: directUrl }, 
                                            mimetype: 'video/mp4', 
                                            fileName: `[ZANTA-MD] ${data.title}.mp4`,
                                            caption: `🎬 *${data.title}*\n📊 *Quality:* ${selectedDl.quality}\n\n> *© ZANTA-MD*`
                                        }, { quoted: qMsg });
                                        
                                        await bot.sendMessage(from, { react: { text: '✅', key: qMsg.key } });
                                    } catch (err) {
                                        reply("❌ Download link error.");
                                    }
                                }
                            }
                        };
                        bot.ev.on('messages.upsert', qualityListener);
                        setTimeout(() => bot.ev.off('messages.upsert', qualityListener), 300000);

                    } catch (err) {
                        reply("❌ Error fetching info.");
                    }
                }
            }
        };

        bot.ev.on('messages.upsert', movieListener);
        setTimeout(() => bot.ev.off('messages.upsert', movieListener), 300000);

    } catch (e) {
        console.error("MOVIE ERROR:", e);
        reply("❌ *Error:* " + e.message);
    }
});
