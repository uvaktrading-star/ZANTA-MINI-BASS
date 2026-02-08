const { cmd } = require("../command");
const axios = require("axios");

// තාවකාලිකව දත්ත මතක තබා ගැනීමට (Memory Store)
const movieSession = {}; 

const API_KEY = "darknero";
const BASE_API = "https://apis.sandarux.sbs/api/movie";

// 1. ප්‍රධාන Movie Search Command එක
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

        const searchRes = await axios.get(`${BASE_API}/sinhalasub-search?apikey=${API_KEY}&q=${encodeURIComponent(q)}`);
        
        if (!searchRes.data.status || !searchRes.data.results.length) {
            return reply("❌ No results found for your search.");
        }

        const results = searchRes.data.results.slice(0, 10);
        
        // Session එකක් Create කරනවා (මේක විනාඩි 10කින් මැකෙනවා)
        movieSession[sender] = { 
            step: 'selection', 
            results: results, 
            time: Date.now() 
        };

        let msg = `🎬 *ZANTA MOVIE SEARCH* 🎬\n\n`;
        results.forEach((res, index) => {
            msg += `${index + 1}️⃣ *${res.title}*\n`;
        });
        msg += `\n*Reply with a number to see details.* \n\n> *© ZANTA-MD MOVIE SERVICE*`;

        await bot.sendMessage(from, { 
            image: { url: results[0].thumbnail || "https://i.ibb.co/vz609p0/movie.jpg" }, 
            caption: msg 
        }, { quoted: mek });

    } catch (e) {
        console.error(e);
        reply("❌ Search error: " + e.message);
    }
});

// 2. Reply අල්ලාගන්නා කොටස (On Text Listener)
cmd({
    on: "text"
}, async (bot, mek, m, { body, from, sender, reply }) => {
    
    // 1 වන පියවර: චිත්‍රපටය තේරීම
    if (movieSession[sender] && movieSession[sender].step === 'selection' && !isNaN(body)) {
        const index = parseInt(body) - 1;
        const selected = movieSession[sender].results[index];

        if (!selected) return; // වැරදි අංකයක් නම් කිසිවක් නොකරයි

        await bot.sendMessage(from, { react: { text: '⏳', key: m.key } });

        try {
            const infoRes = await axios.get(`${BASE_API}/sinhalasub-info?apikey=${API_KEY}&url=${selected.link}`);
            const data = infoRes.data.result;

            movieSession[sender].step = 'quality';
            movieSession[sender].selectedMovie = data;
            movieSession[sender].dl_links = data.dl_links;

            let msg = `🎬 *${data.title}* 🎬\n\n` +
                      `📅 *Release:* ${data.release_date}\n` +
                      `⭐ *IMDb:* ${data.imdb_rating}\n` +
                      `🎭 *Genres:* ${data.genres}\n\n` +
                      `*Select Download Quality:* \n\n`;

            data.dl_links.forEach((dl, i) => {
                msg += `${i + 1}️⃣ ${dl.quality} (${dl.size})\n`;
            });

            msg += `\n> *Reply with the number to get the file.*`;

            await bot.sendMessage(from, { image: { url: data.image }, caption: msg }, { quoted: mek });

        } catch (e) {
            reply("❌ Error fetching movie info.");
        }
    }

    // 2 වන පියවර: Quality එක තේරීම සහ Document එක යැවීම
    else if (movieSession[sender] && movieSession[sender].step === 'quality' && !isNaN(body)) {
        const index = parseInt(body) - 1;
        const selectedDl = movieSession[sender].dl_links[index];
        const movieTitle = movieSession[sender].selectedMovie.title;

        if (!selectedDl) return;

        await bot.sendMessage(from, { react: { text: '⬇️', key: m.key } });
        
        // Session එක පිරිසිදු කරනවා වැඩේ ඉවර නිසා
        delete movieSession[sender];

        try {
            const dlRes = await axios.get(`${BASE_API}/sinhalasub-download?apikey=${API_KEY}&url=${selectedDl.link}`);
            
            if (dlRes.data.status) {
                const pixeldrainUrl = dlRes.data.result.pixeldrain_url;
                const fileId = pixeldrainUrl.split('/').pop();
                const directUrl = `https://pixeldrain.com/api/file/${fileId}?download`;

                await bot.sendMessage(from, { 
                    document: { url: directUrl }, 
                    mimetype: 'video/mp4', 
                    fileName: `[ZANTA-MD] ${movieTitle}.mp4`,
                    caption: `🎬 *${movieTitle}*\n📊 *Quality:* ${selectedDl.quality}\n\n> *© ZANTA-MD MOVIE SERVICE*`
                }, { quoted: mek });

                await bot.sendMessage(from, { react: { text: '✅', key: m.key } });
            }
        } catch (e) {
            reply("❌ Failed to generate download link.");
        }
    }
});

// විනාඩි 10කට පසු Session දත්ත ඉබේම මකා දැමීම (Server එක Slow නොවීමට)
setInterval(() => {
    const now = Date.now();
    for (const user in movieSession) {
        if (now - movieSession[user].time > 600000) {
            delete movieSession[user];
        }
    }
}, 60000);
