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
        if (!q) return reply("🎬 *ZANTA MOVIE SEARCH*");

        const searchRes = await axios.get(`${BASE_API}/sinhalasub-search?apikey=${API_KEY}&q=${encodeURIComponent(q)}`);
        if (!searchRes.data.status || !searchRes.data.results.length) return reply("❌ No results found.");

        const results = searchRes.data.results.slice(0, 10);
        let msg = `🎬 *ZANTA MOVIE SEARCH* 🎬\n\n`;
        results.forEach((res, index) => msg += `${index + 1}️⃣ *${res.title.split('|')[0].trim()}*\n`);
        
        const sentMsg = await bot.sendMessage(from, { 
            image: { url: results[0].image }, 
            caption: msg + `\n*Reply with the number to see quality list.*`
        }, { quoted: mek });

        const movieListener = async (update) => {
            const msgUpdate = update.messages[0];
            if (!msgUpdate.message) return;
            const body = msgUpdate.message.conversation || msgUpdate.message.extendedTextMessage?.text;
            
            if (msgUpdate.message.extendedTextMessage?.contextInfo?.stanzaId === sentMsg.key.id && !isNaN(body)) {
                const selectedMovie = results[parseInt(body) - 1];
                if (selectedMovie) {
                    bot.ev.off('messages.upsert', movieListener);

                    try {
                        const infoRes = await axios.get(`${BASE_API}/sinhalasub-info?apikey=${API_KEY}&url=${selectedMovie.link}`);
                        const rawLinks = infoRes.data.links.Pixeldrain || infoRes.data.links["DLServer 02"];
                        
                        const hd = rawLinks.find(l => l.quality.includes('720p') || l.quality.includes('HD'));
                        const sd = rawLinks.find(l => l.quality.includes('480p') || l.quality.includes('SD'));

                        let displayLinks = [];
                        if (hd) displayLinks.push({ ...hd, label: "HD - 720p" });
                        if (sd) displayLinks.push({ ...sd, label: "SD - 480p" });

                        let infoMsg = `🎬 *${selectedMovie.title.split('|')[0].trim()}*\n\n`;
                        displayLinks.forEach((dl, i) => infoMsg += `${i + 1}️⃣ ${dl.label} (${dl.size})\n`);

                        const infoSent = await bot.sendMessage(from, { image: { url: selectedMovie.image }, caption: infoMsg }, { quoted: msgUpdate });

                        const qualityListener = async (qUpdate) => {
                            const qMsg = qUpdate.messages[0];
                            const qBody = qMsg.message?.conversation || qMsg.message?.extendedTextMessage?.text;

                            if (qMsg.message?.extendedTextMessage?.contextInfo?.stanzaId === infoSent.key.id && !isNaN(qBody)) {
                                let selectedDl = displayLinks[parseInt(qBody) - 1];
                                if (selectedDl) {
                                    bot.ev.off('messages.upsert', qualityListener);

                                    // Size Limit Check
                                    const sizeInGB = parseFloat(selectedDl.size);
                                    if (selectedDl.size.includes('GB') && sizeInGB > 1.5) {
                                        return reply("⚠️ මේ ෆයිල් එක 1.5GB ට වඩා වැඩියි. කරුණාකර SD quality එක තෝරන්න.");
                                    }

                                    await reply("📥 *Uploading your movie... Please wait.*");
                                    await bot.sendMessage(from, { react: { text: '⬇️', key: qMsg.key } });

                                    try {
                                        const dlRes = await axios.get(`${BASE_API}/sinhalasub-download?apikey=${API_KEY}&url=${selectedDl.link}`);
                                        let finalUrl = dlRes.data.url;
                                        if (finalUrl.includes('pixeldrain.com/u/')) finalUrl = finalUrl.replace('/u/', '/api/file/') + "?download";

                                        // --- විසඳුම: Stream එකක් වෙනුවට Buffer එකක් විදිහට Axios වලින් ගන්නවා ---
                                        // Arraybuffer එකක් පාවිච්චි කිරීමෙන් ENOENT error එක සම්පූර්ණයෙන්ම නැති වේ.
                                        const response = await axios.get(finalUrl, { 
                                            responseType: 'arraybuffer',
                                            headers: { 'User-Agent': 'Mozilla/5.0' }
                                        });

                                        const movieBuffer = Buffer.from(response.data, 'binary');

                                        await bot.sendMessage(from, { 
                                            document: movieBuffer, 
                                            mimetype: 'video/mp4', 
                                            fileName: `[ZANTA-MD] ${selectedMovie.title.split('|')[0].trim()}.mp4`,
                                            caption: `🎬 *${selectedMovie.title.split('|')[0].trim()}*\n📊 *Quality:* ${selectedDl.label}\n⚖️ *Size:* ${selectedDl.size}`
                                        }, { quoted: qMsg });

                                        // --- RAM Cleanup (වැදගත්ම කොටස) ---
                                        delete response.data; 
                                        // Buffer එක null කිරීමෙන් Memory නිදහස් වේ
                                        // global.gc() තිබේ නම් එය ක්‍රියාත්මක වේ
                                        if (global.gc) global.gc(); 

                                        await bot.sendMessage(from, { react: { text: '✅', key: qMsg.key } });

                                    } catch (err) {
                                        reply("❌ Error: " + err.message);
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
