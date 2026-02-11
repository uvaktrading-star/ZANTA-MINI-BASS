const { cmd } = require("../command");
const axios = require("axios");

const API_KEY = "darknero";
const BASE_API = "https://apis.sandarux.sbs/api/movie";

cmd({
    pattern: "movie",
    alias: ["film", "sinhalasub"],
    react: "🎬",
    desc: "Search movies from Sinhalasub with Direct Stream.",
    category: "download",
    filename: __filename
}, async (bot, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("🎬 *ZANTA MOVIE SEARCH*\n\nExample: .movie Avengers");

        // --- 1. සර්ච් කිරීම ---
        const searchRes = await axios.get(`${BASE_API}/sinhalasub-search?apikey=${API_KEY}&q=${encodeURIComponent(q)}`).catch(() => null);
        
        if (!searchRes || !searchRes.data.status || !searchRes.data.results.length) {
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

        // --- 2. Movie Selection Listener ---
        const movieListener = async (update) => {
            try {
                const msgUpdate = update.messages[0];
                if (!msgUpdate.message) return;

                const body = msgUpdate.message.conversation || msgUpdate.message.extendedTextMessage?.text;
                const isReplyToBot = msgUpdate.message.extendedTextMessage?.contextInfo?.stanzaId === sentMsg.key.id;

                if (isReplyToBot && body && !isNaN(body)) {
                    const index = parseInt(body) - 1;
                    const selectedMovie = results[index];

                    if (selectedMovie) {
                        bot.ev.off('messages.upsert', movieListener);
                        await bot.sendMessage(from, { react: { text: '⏳', key: msgUpdate.key } });

                        // --- 3. මූවී විස්තර ලබා ගැනීම ---
                        const infoRes = await axios.get(`${BASE_API}/sinhalasub-info?apikey=${API_KEY}&url=${selectedMovie.link}`).catch(() => null);
                        if (!infoRes || !infoRes.data.status) return reply("❌ විස්තර ලබා ගැනීමේදී දෝෂයක් සිදු විය.");

                        const infoData = infoRes.data;
                        const pixeldrainLinks = infoData.links.Pixeldrain || infoData.links["DLServer 02"] || infoData.links["UsersDrive"]; 

                        if (!pixeldrainLinks || pixeldrainLinks.length === 0) return reply("❌ No download links found.");

                        let infoMsg = `🎬 *${selectedMovie.title.split('|')[0].trim()}* 🎬\n\n` +
                                     `*Available Qualities:* \n\n`;

                        pixeldrainLinks.forEach((dl, i) => {
                            infoMsg += `${i + 1}️⃣ ${dl.quality} (${dl.size})\n`;
                        });
                        infoMsg += `\n> *Reply with the number to download.*`;

                        const infoSent = await bot.sendMessage(from, { 
                            image: { url: selectedMovie.image }, 
                            caption: infoMsg 
                        }, { quoted: msgUpdate });

                        // --- 4. Quality Selection Listener ---
                        const qualityListener = async (qUpdate) => {
                            try {
                                const qMsg = qUpdate.messages[0];
                                const qBody = qMsg.message?.conversation || qMsg.message?.extendedTextMessage?.text;
                                const isReplyToInfo = qMsg.message?.extendedTextMessage?.contextInfo?.stanzaId === infoSent.key.id;

                                if (isReplyToInfo && qBody && !isNaN(qBody)) {
                                    const qIndex = parseInt(qBody) - 1;
                                    const selectedDl = pixeldrainLinks[qIndex];

                                    if (selectedDl) {
                                        bot.ev.off('messages.upsert', qualityListener);

                                        // 2GB Max Check
                                        const sizeVal = parseFloat(selectedDl.size);
                                        if (selectedDl.size.includes('GB') && sizeVal > 2.0) {
                                            return reply("⚠️ මේ ෆයිල් එක 2GB ට වඩා වැඩියි. WhatsApp සීමාව ඉක්මවා ඇත.");
                                        }

                                        await bot.sendMessage(from, { react: { text: '⬇️', key: qMsg.key } });

                                        // --- 5. Download Link Fetch ---
                                        const dlRes = await axios.get(`${BASE_API}/sinhalasub-download?apikey=${API_KEY}&url=${selectedDl.link}`).catch(() => null);
                                        if (!dlRes || !dlRes.data.url) return reply("❌ ඩවුන්ලෝඩ් ලින්ක් එක ලබා ගැනීමට නොහැකි විය.");

                                        let finalUrl = dlRes.data.url;

                                        // Pixeldrain Direct Stream Optimization
                                        if (finalUrl.includes('pixeldrain.com/u/')) {
                                            finalUrl = finalUrl.replace('/u/', '/api/file/') + "?download";
                                        }

                                        const waitMsg = await reply("📥 *ZANTA-MD is streaming your movie to WhatsApp...* \n\n*No buffering, please wait.*");

                                        // [BAILEYS DIRECT STREAMING - 0% RAM USAGE]
                                        await bot.sendMessage(from, { 
                                            document: { url: finalUrl }, 
                                            mimetype: 'video/mp4', 
                                            fileName: `[ZANTA-MD] ${selectedMovie.title.split('|')[0].trim()}.mp4`,
                                            caption: `🎬 *${selectedMovie.title.split('|')[0].trim()}*\n📊 *Quality:* ${selectedDl.quality}\n⚖️ *Size:* ${selectedDl.size}\n\n> *© ZANTA-MD MOVIE SERVICE*`
                                        }, { quoted: qMsg });

                                        await bot.sendMessage(from, { delete: waitMsg.key }).catch(() => null);
                                        await bot.sendMessage(from, { react: { text: '✅', key: qMsg.key } });
                                    }
                                }
                            } catch (err) {
                                console.error("Quality Listener Error:", err);
                            }
                        };

                        bot.ev.on('messages.upsert', qualityListener);
                        setTimeout(() => bot.ev.off('messages.upsert', qualityListener), 300000);
                    }
                }
            } catch (err) {
                console.error("Movie Listener Error:", err);
            }
        };

        bot.ev.on('messages.upsert', movieListener);
        setTimeout(() => bot.ev.off('messages.upsert', movieListener), 300000);

    } catch (e) {
        console.error("Main Command Error:", e);
        reply("❌ දෝෂයක් සිදු විය.");
    }
});
