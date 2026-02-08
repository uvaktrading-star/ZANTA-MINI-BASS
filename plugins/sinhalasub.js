const { cmd } = require("../command");
const axios = require("axios");

const API_KEY = "darknero";
const BASE_API = "https://apis.sandarux.sbs/api/movie";

cmd({
    pattern: "movie",
    alias: ["film", "sinhalasub"],
    react: "🎬",
    desc: "Search movies from Sinhalasub",
    category: "download",
    filename: __filename
}, async (bot, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("🎬 *ZANTA MOVIE SEARCH*\n\nExample: .movie Avengers");

        const searchRes = await axios.get(`${BASE_API}/sinhalasub-search?apikey=${API_KEY}&q=${encodeURIComponent(q)}`);
        
        if (!searchRes.data.status || !searchRes.data.results.length) {
            return reply("❌ කිසිදු ප්‍රතිඵලයක් හමු නොවීය.");
        }

        const results = searchRes.data.results.slice(0, 10);
        let msg = `🎬 *ZANTA MOVIE SEARCH* 🎬\n\n`;
        
        results.forEach((res, index) => {
            msg += `${index + 1}️⃣ *${res.title.split('|')[0].trim()}*\n`;
        });
        msg += `\n*Reply with the number to see quality list.* \n\n> *© ZANTA-MD MOVIE SERVICE*`;

        const sentMsg = await bot.sendMessage(from, { 
            image: { url: results[0].image || "https://i.ibb.co/vz609p0/movie.jpg" }, 
            caption: msg 
        }, { quoted: mek });

        const movieListener = async (update) => {
            const msgUpdate = update.messages[0];
            if (!msgUpdate.message) return;

            const body = msgUpdate.message.conversation || msgUpdate.message.extendedTextMessage?.text;
            const isReplyToBot = msgUpdate.message.extendedTextMessage?.contextInfo?.stanzaId === sentMsg.key.id;

            if (isReplyToBot && !isNaN(body)) {
                const index = parseInt(body) - 1;
                const selectedMovie = results[index];

                if (selectedMovie) {
                    bot.ev.off('messages.upsert', movieListener);
                    await bot.sendMessage(from, { react: { text: '⏳', key: msgUpdate.key } });

                    try {
                        const infoRes = await axios.get(`${BASE_API}/sinhalasub-info?apikey=${API_KEY}&url=${selectedMovie.link}`);
                        const infoData = infoRes.data;
                        const pixeldrainLinks = infoData.links.Pixeldrain || infoData.links["DLServer 02"] || infoData.links["UsersDrive"]; 

                        if (!pixeldrainLinks) return reply("❌ No download links found.");

                        let infoMsg = `🎬 *${selectedMovie.title.split('|')[0].trim()}* 🎬\n\n` + `*Available Qualities:* \n\n`;
                        pixeldrainLinks.forEach((dl, i) => {
                            infoMsg += `${i + 1}️⃣ ${dl.quality} (${dl.size})\n`;
                        });
                        infoMsg += `\n> *Reply with the number to download.*`;

                        const infoSent = await bot.sendMessage(from, { 
                            image: { url: selectedMovie.image }, 
                            caption: infoMsg 
                        }, { quoted: msgUpdate });

                        const qualityListener = async (qUpdate) => {
                            const qMsg = qUpdate.messages[0];
                            const qBody = qMsg.message?.conversation || qMsg.message?.extendedTextMessage?.text;
                            const isReplyToInfo = qMsg.message?.extendedTextMessage?.contextInfo?.stanzaId === infoSent.key.id;

                            if (isReplyToInfo && !isNaN(qBody)) {
                                const qIndex = parseInt(qBody) - 1;
                                const selectedDl = pixeldrainLinks[qIndex];

                                if (selectedDl) {
                                    bot.ev.off('messages.upsert', qualityListener);
                                    await bot.sendMessage(from, { react: { text: '⬇️', key: qMsg.key } });

                                    try {
                                        const dlRes = await axios.get(`${BASE_API}/sinhalasub-download?apikey=${API_KEY}&url=${selectedDl.link}`);
                                        let finalUrl = dlRes.data.url;

                                        if (finalUrl.includes('pixeldrain.com/u/')) {
                                            finalUrl = finalUrl.replace('/u/', '/api/file/') + "?download";
                                        }

                                        // --- RAM-SAFE STREAMING LOGIC ---
                                        const response = await axios({
                                            method: 'get',
                                            url: finalUrl,
                                            responseType: 'stream',
                                            timeout: 0
                                        });

                                        await bot.sendMessage(from, { 
                                            document: response.data, 
                                            mimetype: 'video/mp4', 
                                            fileName: `[ZANTA-MD] ${selectedMovie.title.split('|')[0].trim()}.mp4`,
                                            caption: `🎬 *${selectedMovie.title.split('|')[0].trim()}*\n📊 *Quality:* ${selectedDl.quality}\n\n> *© ZANTA-MD*`
                                        }, { quoted: qMsg });
                                        
                                        // වැඩේ ඉවර වුණ ගමන් stream එක විනාශ කරලා memory එක නිදහස් කරනවා
                                        response.data.destroy(); 
                                        
                                        await bot.sendMessage(from, { react: { text: '✅', key: qMsg.key } });

                                    } catch (err) {
                                        reply("❌ Download error. Heroku memory limit exceeded.");
                                    }
                                }
                            }
                        };
                        bot.ev.on('messages.upsert', qualityListener);
                        setTimeout(() => bot.ev.off('messages.upsert', qualityListener), 300000);
                    } catch (err) {
                        reply("❌ විස්තර ලබා ගැනීමේ දෝෂයකි.");
                    }
                }
            }
        };
        bot.ev.on('messages.upsert', movieListener);
        setTimeout(() => bot.ev.off('messages.upsert', movieListener), 300000);
    } catch (e) {
        reply("❌ දෝෂයක් සිදු විය: " + e.message);
    }
});
