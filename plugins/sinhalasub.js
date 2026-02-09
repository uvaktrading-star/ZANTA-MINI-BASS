const { cmd } = require("../command");
const axios = require("axios");

const API_KEY = "darknero";
const BASE_API = "https://apis.sandarux.sbs/api/movie";

cmd({
    pattern: "movie",
    alias: ["film", "sinhalasub"],
    react: "🎬",
    category: "download",
    filename: __filename
}, async (bot, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("🎬 *ZANTA MOVIE SEARCH*\n\nExample: .movie Avengers");

        const searchRes = await axios.get(`${BASE_API}/sinhalasub-search?apikey=${API_KEY}&q=${encodeURIComponent(q)}`);
        if (!searchRes.data.status || !searchRes.data.results.length) return reply("❌ කිසිදු ප්‍රතිඵලයක් හමු නොවීය.");

        const results = searchRes.data.results.slice(0, 10);
        let msg = `🎬 *ZANTA MOVIE SEARCH* 🎬\n\n`;
        results.forEach((res, index) => msg += `${index + 1}️⃣ *${res.title.split('|')[0].trim()}*\n`);
        msg += `\n*Reply with the number to see quality list.*`;

        const sentMsg = await bot.sendMessage(from, { 
            image: { url: results[0].image }, 
            caption: msg 
        }, { quoted: mek });

        const movieListener = async (update) => {
            const msgUpdate = update.messages[0];
            if (!msgUpdate.message) return;
            const body = msgUpdate.message.conversation || msgUpdate.message.extendedTextMessage?.text;
            
            if (msgUpdate.message.extendedTextMessage?.contextInfo?.stanzaId === sentMsg.key.id && !isNaN(body)) {
                const selectedMovie = results[parseInt(body) - 1];
                if (selectedMovie) {
                    bot.ev.off('messages.upsert', movieListener);
                    await bot.sendMessage(from, { react: { text: '⏳', key: msgUpdate.key } });

                    try {
                        const infoRes = await axios.get(`${BASE_API}/sinhalasub-info?apikey=${API_KEY}&url=${selectedMovie.link}`);
                        const rawLinks = infoRes.data.links.Pixeldrain || infoRes.data.links["DLServer 02"] || infoRes.data.links["UsersDrive"];
                        
                        // --- නිවැරදිව SD සහ HD වෙන් කර ගැනීම ---
                        let filteredLinks = [];
                        
                        // 1. මුලින්ම HD (720p) එකක් තියෙනවා නම් ඒක ගන්නවා
                        const hdLink = rawLinks.find(l => l.quality.includes('720p') || l.quality.includes('HD'));
                        if (hdLink) filteredLinks.push({ ...hdLink, qName: "HD - 720p" });

                        // 2. ඊළඟට SD (480p) එකක් තියෙනවා නම් ඒක ගන්නවා
                        const sdLink = rawLinks.find(l => l.quality.includes('480p') || l.quality.includes('SD'));
                        if (sdLink) filteredLinks.push({ ...sdLink, qName: "SD - 480p" });

                        if (filteredLinks.length === 0) return reply("❌ සුදුසු Quality එකක් (HD/SD) හමු නොවීය.");

                        let infoMsg = `🎬 *${selectedMovie.title.split('|')[0].trim()}*\n\n`;
                        filteredLinks.forEach((dl, i) => {
                            infoMsg += `${i + 1}️⃣ ${dl.qName} (${dl.size})\n`;
                        });
                        infoMsg += `\n> *Reply with the number to download.*`;

                        const infoSent = await bot.sendMessage(from, { 
                            image: { url: selectedMovie.image }, 
                            caption: infoMsg 
                        }, { quoted: msgUpdate });

                        const qualityListener = async (qUpdate) => {
                            const qMsg = qUpdate.messages[0];
                            const qBody = qMsg.message?.conversation || qMsg.message?.extendedTextMessage?.text;

                            if (qMsg.message?.extendedTextMessage?.contextInfo?.stanzaId === infoSent.key.id && !isNaN(qBody)) {
                                const selectedDl = filteredLinks[parseInt(qBody) - 1];
                                if (selectedDl) {
                                    bot.ev.off('messages.upsert', qualityListener);

                                    // Size Limit Check (1.5GB)
                                    const sizeInGB = parseFloat(selectedDl.size);
                                    if (selectedDl.size.includes('GB') && sizeInGB > 1.5) {
                                        return reply("⚠️ මේ ෆයිල් එක 1.5GB ට වඩා වැඩියි. කරුණාකර අඩු Quality එකක් (SD) තෝරාගන්න.");
                                    }

                                    const wait = await reply("📥 *Downloading your movie... Please wait.*");

                                    try {
                                        const dlRes = await axios.get(`${BASE_API}/sinhalasub-download?apikey=${API_KEY}&url=${selectedDl.link}`);
                                        let finalUrl = dlRes.data.url;
                                        if (finalUrl.includes('pixeldrain.com/u/')) finalUrl = finalUrl.replace('/u/', '/api/file/') + "?download";

                                        // Streaming via Gifted-Baileys
                                        const response = await axios({ method: 'get', url: finalUrl, responseType: 'stream' });

                                        await bot.sendMessage(from, { 
                                            document: response.data, 
                                            mimetype: 'video/mp4', 
                                            fileName: `[ZANTA-MD] ${selectedMovie.title.split('|')[0].trim()}.mp4`,
                                            caption: `🎬 *${selectedMovie.title.split('|')[0].trim()}*\n📊 *Quality:* ${selectedDl.qName}\n⚖️ *Size:* ${selectedDl.size}\n\n> *© ZANTA-MD*`
                                        }, { quoted: qMsg });

                                        // RAM Cleanup
                                        response.data.destroy();
                                        if (global.gc) global.gc();
                                        
                                        await bot.sendMessage(from, { delete: wait.key });
                                        await bot.sendMessage(from, { react: { text: '✅', key: qMsg.key } });

                                    } catch (err) {
                                        reply("❌ බාගත කිරීමේදී දෝෂයක් ඇති විය.");
                                    }
                                }
                            }
                        };
                        bot.ev.on('messages.upsert', qualityListener);
                    } catch (err) { reply("❌ විස්තර ලබා ගැනීමේ දෝෂයකි."); }
                }
            }
        };
        bot.ev.on('messages.upsert', movieListener);
    } catch (e) { reply("❌ Error: " + e.message); }
});
