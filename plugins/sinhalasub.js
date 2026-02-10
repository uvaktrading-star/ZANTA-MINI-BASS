const { cmd } = require("../command");
const axios = require("axios");

const API_KEY = "darknero";
const BASE_API = "https://apis.sandarux.sbs/api/movie";

// තාවකාලිකව දත්ත මතක තබා ගැනීමට
const movieData = new Map();

cmd({
    pattern: "movie",
    alias: ["film", "sinhalasub"],
    react: "🎬",
    desc: "Search and download movies with zero RAM usage",
    category: "download",
    filename: __filename
}, async (bot, mek, m, { from, q, reply }) => {
    try {
        const body = m.text;
        const isReply = m.quoted ? m.quoted.stanzaId : null;

        // 1. Quality එක තෝරාගැනීම (Step 3)
        if (m.quoted && movieData.has(from + m.quoted.stanzaId + "_info")) {
            const data = movieData.get(from + m.quoted.stanzaId + "_info");
            const index = parseInt(q) - 1;
            const selectedDl = data.links[index];

            if (!selectedDl) return reply("⚠️ වැරදි අංකයකි.");

            await bot.sendMessage(from, { react: { text: '⏳', key: m.key } });
            
            // Download URL එක ගැනීම
            const dlRes = await axios.get(`${BASE_API}/sinhalasub-download?apikey=${API_KEY}&url=${selectedDl.link}`);
            let finalUrl = dlRes.data.url;

            // Pixeldrain direct download link එකක් බවට පත් කිරීම
            if (finalUrl.includes('pixeldrain.com/u/')) {
                finalUrl = finalUrl.replace('/u/', '/api/file/') + "?download";
            }

            // [RAM OPTIMIZED SENDING]
            // මෙතනදී Gifted-Baileys විසින් URL එක හරහා Direct Stream කරයි.
            await bot.sendMessage(from, { 
                document: { url: finalUrl }, 
                mimetype: 'video/mp4', 
                fileName: `[ZANTA-MD] ${data.title}.mp4`,
                caption: `🎬 *${data.title}*\n⚖️ *Size:* ${selectedDl.size}\n\n> *© ZANTA-MD MOVIE SERVICE*`
            }, { quoted: m });

            await bot.sendMessage(from, { react: { text: '✅', key: m.key } });
            return;
        }

        // 2. Movie එක තෝරාගැනීම (Step 2)
        if (m.quoted && movieData.has(from + m.quoted.stanzaId + "_search")) {
            const results = movieData.get(from + m.quoted.stanzaId + "_search");
            const index = parseInt(q) - 1;
            const selectedMovie = results[index];

            if (!selectedMovie) return reply("⚠️ වැරදි අංකයකි.");

            await bot.sendMessage(from, { react: { text: '🔍', key: m.key } });
            const infoRes = await axios.get(`${BASE_API}/sinhalasub-info?apikey=${API_KEY}&url=${selectedMovie.link}`);
            const pixeldrainLinks = infoRes.data.links.Pixeldrain || infoRes.data.links["DLServer 02"] || [];

            if (pixeldrainLinks.length === 0) return reply("❌ Download links හමු නොවීය.");

            let infoMsg = `🎬 *${selectedMovie.title.split('|')[0].trim()}*\n\n*Available Qualities:* \n\n`;
            pixeldrainLinks.forEach((dl, i) => {
                infoMsg += `${i + 1}️⃣ ${dl.quality} (${dl.size})\n`;
            });
            infoMsg += `\n> *Reply with the number to download.*`;

            const sentInfo = await bot.sendMessage(from, { 
                image: { url: selectedMovie.image }, 
                caption: infoMsg 
            }, { quoted: m });

            // Info දත්ත සේව් කිරීම (ඊළඟ පියවර සඳහා)
            movieData.set(from + sentInfo.key.id + "_info", { title: selectedMovie.title.split('|')[0].trim(), links: pixeldrainLinks });
            return;
        }

        // 3. මුලින්ම සර්ච් කිරීම (Step 1)
        if (!q) return reply("🎬 *ZANTA MOVIE SEARCH*\n\nExample: .movie Avengers");

        const searchRes = await axios.get(`${BASE_API}/sinhalasub-search?apikey=${API_KEY}&q=${encodeURIComponent(q)}`);
        if (!searchRes.data.status || !searchRes.data.results.length) return reply("❌ ප්‍රතිඵල හමු නොවීය.");

        const results = searchRes.data.results.slice(0, 10);
        let msg = `🎬 *ZANTA MOVIE SEARCH* 🎬\n\n`;
        results.forEach((res, index) => {
            msg += `${index + 1}️⃣ *${res.title.split('|')[0].trim()}*\n`;
        });
        msg += `\n> *Reply with the number to see details.*`;

        const sentSearch = await bot.sendMessage(from, { 
            image: { url: results[0].image }, 
            caption: msg 
        }, { quoted: mek });

        // සර්ච් දත්ත සේව් කිරීම
        movieData.set(from + sentSearch.key.id + "_search", results);

    } catch (e) {
        console.error(e);
        reply("❌ දෝෂයක් සිදු විය: " + e.message);
    }
});
