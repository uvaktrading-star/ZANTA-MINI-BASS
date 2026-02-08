const { cmd } = require("../command");
const axios = require("axios");

// තාවකාලිකව දත්ත ගබඩා කිරීමට
const pendingMovie = {};
const pendingQuality = {};

const API_KEY = "darknero";
const BASE_API = "https://apis.sandarux.sbs/api/movie";

cmd({
    pattern: "movie",
    alias: ["sinhalasub", "film"],
    react: "🎬",
    desc: "Search and download movies from Sinhalasub.",
    category: "download",
    filename: __filename
}, async (conn, mek, m, { from, q, sender, reply }) => {
    try {
        if (!q) return reply("❗ කරුණාකර චිත්‍රපටයේ නම ලබා දෙන්න. (උදා: .movie Avengers)");

        reply("🔎 Searching for movie...");

        // 1. Search API
        const searchRes = await axios.get(`${BASE_API}/sinhalasub-search?apikey=${API_KEY}&q=${encodeURIComponent(q)}`);
        
        if (!searchRes.data.status || !searchRes.data.results.length) {
            return reply("❌ කිසිදු චිත්‍රපටයක් හමු නොවීය.");
        }

        const results = searchRes.data.results.slice(0, 10);
        pendingMovie[sender] = { results, timestamp: Date.now() };

        let msg = "*🎬 SINHALASUB MOVIE SEARCH*\n\n";
        results.forEach((res, index) => {
            msg += `*${index + 1}.* ${res.title}\n`;
        });
        msg += "\n*Reply පණිවිඩයක් ලෙස අදාළ අංකය ලබා දෙන්න.*";

        await conn.sendMessage(from, { text: msg }, { quoted: mek });

    } catch (e) {
        console.log(e);
        reply("❌ දෝෂයක් සිදු විය: " + e.message);
    }
});

// Reply Logic - චිත්‍රපටය තේරීම සහ Info ලබා ගැනීම
cmd({
    on: "text"
}, async (conn, mek, m, { body, from, sender, reply }) => {
    const prefix = "."; // ඔයාගේ බොට්ගේ prefix එක මෙතනට දාන්න
    if (body.startsWith(prefix)) return; 

    // 1. චිත්‍රපට අංකය තේරීම
    if (pendingMovie[sender] && !isNaN(body)) {
        const index = parseInt(body) - 1;
        const selected = pendingMovie[sender].results[index];

        if (selected) {
            delete pendingMovie[sender];
            reply("📥 Fetching movie details...");

            try {
                // 2. Info API
                const infoRes = await axios.get(`${BASE_API}/sinhalasub-info?apikey=${API_KEY}&url=${selected.link}`);
                const data = infoRes.data.result;

                let msg = `*🎬 ${data.title}*\n\n`;
                msg += `📅 Release: ${data.release_date}\n`;
                msg += `⭐ Rating: ${data.imdb_rating}\n`;
                msg += `🎭 Genres: ${data.genres}\n\n`;
                msg += `*📥 Available Qualities:*\n`;

                data.dl_links.forEach((dl, i) => {
                    msg += `*${i + 1}.* ${dl.quality} (${dl.size})\n`;
                });

                msg += "\n*බාගත කිරීමට අවශ්‍ය Quality අංකය Reply කරන්න.*";

                pendingQuality[sender] = { links: data.dl_links, title: data.title, timestamp: Date.now() };
                
                await conn.sendMessage(from, { image: { url: data.image }, caption: msg }, { quoted: mek });

            } catch (e) {
                reply("❌ විස්තර ලබා ගැනීමට නොහැකි විය.");
            }
        }
    }

    // 2. Quality එක තේරීම සහ Direct Link ලබා ගැනීම
    else if (pendingQuality[sender] && !isNaN(body)) {
        const index = parseInt(body) - 1;
        const selectedLink = pendingQuality[sender].links[index];

        if (selectedLink) {
            const movieTitle = pendingQuality[sender].title;
            delete pendingQuality[sender];
            reply("🔗 Generating download link...");

            try {
                // 3. Download API
                const dlRes = await axios.get(`${BASE_API}/sinhalasub-download?apikey=${API_KEY}&url=${selectedLink.link}`);
                
                if (dlRes.data.status) {
                    const directUrl = dlRes.data.result.pixeldrain_url; // මෙතන pixeldrain api එකෙන් direct link එක ගන්නවා
                    const finalDl = `https://pixeldrain.com/api/file/${directUrl.split('/').pop()}?download`;

                    await conn.sendMessage(from, { 
                        document: { url: finalDl }, 
                        mimetype: 'video/mp4', 
                        fileName: `${movieTitle}.mp4`,
                        caption: `*🎬 ${movieTitle}*\n✅ Downloaded successfully!`
                    }, { quoted: mek });
                }
            } catch (e) {
                reply("❌ බාගත කිරීමේ ලින්ක් එක සැකසීමට නොහැකි විය.");
            }
        }
    }
});
