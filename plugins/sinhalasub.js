const { cmd } = require("../command");
const axios = require("axios");
const { Stream } = require("stream");

const API_KEY = "darknero";
const BASE_API = "https://apis.sandarux.sbs/api/movie";

// Stream එකක් Buffer එකක් බවට හරවන function එක (RAM එක බේරගෙන)
const streamToBuffer = async (stream) => {
    return new Promise((resolve, reject) => {
        let chunks = [];
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', (err) => reject(err));
    });
};

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
        if (!searchRes.data.status || !searchRes.data.results.length) return reply("❌ No results.");

        const results = searchRes.data.results.slice(0, 10);
        let msg = `🎬 *ZANTA MOVIE SEARCH* 🎬\n\n`;
        results.forEach((res, index) => msg += `${index + 1}️⃣ *${res.title.split('|')[0].trim()}*\n`);

        const sentMsg = await bot.sendMessage(from, { 
            image: { url: results[0].image }, 
            caption: msg + `\n> *© ZANTA-MD*` 
        }, { quoted: mek });

        const movieListener = async (update) => {
            const msgUpdate = update.messages[0];
            if (!msgUpdate.message) return;
            const body = msgUpdate.message.conversation || msgUpdate.message.extendedTextMessage?.text;
            
            if (msgUpdate.message.extendedTextMessage?.contextInfo?.stanzaId === sentMsg.key.id && !isNaN(body)) {
                const selectedMovie = results[parseInt(body) - 1];
                if (selectedMovie) {
                    bot.ev.off('messages.upsert', movieListener);
                    
                    const infoRes = await axios.get(`${BASE_API}/sinhalasub-info?apikey=${API_KEY}&url=${selectedMovie.link}`);
                    const pixeldrainLinks = infoRes.data.links.Pixeldrain || infoRes.data.links["DLServer 02"];
                    const filteredLinks = pixeldrainLinks.filter(l => l.quality.includes('SD') || l.quality.includes('HD') || l.quality.includes('720p'));

                    let infoMsg = `🎬 *${selectedMovie.title.split('|')[0].trim()}*\n\n`;
                    filteredLinks.forEach((dl, i) => infoMsg += `${i + 1}️⃣ ${dl.quality} (${dl.size})\n`);

                    const infoSent = await bot.sendMessage(from, { image: { url: selectedMovie.image }, caption: infoMsg }, { quoted: msgUpdate });

                    const qualityListener = async (qUpdate) => {
                        const qMsg = qUpdate.messages[0];
                        const qBody = qMsg.message?.conversation || qMsg.message?.extendedTextMessage?.text;

                        if (qMsg.message?.extendedTextMessage?.contextInfo?.stanzaId === infoSent.key.id && !isNaN(qBody)) {
                            const selectedDl = filteredLinks[parseInt(qBody) - 1];
                            if (selectedDl) {
                                bot.ev.off('messages.upsert', qualityListener);
                                
                                const waitMsg = await reply("📥 *Downloading & Uploading... Please wait.*");

                                try {
                                    const dlRes = await axios.get(`${BASE_API}/sinhalasub-download?apikey=${API_KEY}&url=${selectedDl.link}`);
                                    let finalUrl = dlRes.data.url;
                                    if (finalUrl.includes('pixeldrain.com/u/')) finalUrl = finalUrl.replace('/u/', '/api/file/') + "?download";

                                    // 1. Axios එකෙන් stream එකක් විදිහට data ගන්නවා
                                    const response = await axios({
                                        method: 'get',
                                        url: finalUrl,
                                        responseType: 'stream'
                                    });

                                    // 2. Stream එක Buffer එකක් කරනවා (ENOENT error එක එන්නේ නැති වෙන්න)
                                    const buffer = await streamToBuffer(response.data);

                                    // 3. Message එක යවනවා
                                    await bot.sendMessage(from, { 
                                        document: buffer, 
                                        mimetype: 'video/mp4', 
                                        fileName: `[ZANTA-MD] ${selectedMovie.title.split('|')[0].trim()}.mp4`,
                                        caption: `🎬 *${selectedMovie.title.split('|')[0].trim()}*\n📊 *Quality:* ${selectedDl.quality}`
                                    }, { quoted: qMsg });

                                    // 🗑️ RAM Cleanup
                                    response.data.destroy();
                                    await bot.sendMessage(from, { delete: waitMsg.key });
                                    await bot.sendMessage(from, { react: { text: '✅', key: qMsg.key } });

                                } catch (err) {
                                    reply("❌ Error: " + err.message);
                                }
                            }
                        }
                    };
                    bot.ev.on('messages.upsert', qualityListener);
                }
            }
        };
        bot.ev.on('messages.upsert', movieListener);
    } catch (e) { reply("❌ Error: " + e.message); }
});
