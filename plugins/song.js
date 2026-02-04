const { cmd } = require("../command");
const axios = require("axios");
const yts = require("yt-search");
const config = require("../config");

// --- 🎵 SONG COMMAND (MANUL-OFFICIAL VERCEL API) ---
cmd({
    pattern: "song",
    alias: ["yta", "mp3", "play"],
    react: "🎧",
    desc: "Download YouTube MP3 via Custom Vercel API",
    category: "download",
    filename: __filename,
}, async (bot, mek, m, { from, q, reply, userSettings }) => {
    try {
        if (!q) return reply("🎧 *ZANTA-MD SONG SEARCH*\n\nExample: .song alone");

        // 1. YouTube Search
        const search = await yts(q);
        const video = search.videos[0];
        if (!video) return reply("❌ No results found on YouTube.");

        const settings = userSettings || global.CURRENT_BOT_SETTINGS || {};
        const botName = settings.botName || config.DEFAULT_BOT_NAME || "ZANTA-MD";

        let msg = `
🎵 *${botName} AUDIO PLAYER* 🎵

📝 *Title:* ${video.title}
👤 *Artist:* ${video.author.name}
⏱️ *Duration:* ${video.timestamp}
🔗 *Link:* ${video.url}

> *📥 Downloading your song via Manul API..*
`;

        // Video Thumbnail එක සමඟ විස්තර යැවීම
        await bot.sendMessage(from, { image: { url: video.thumbnail }, caption: msg }, { quoted: mek });

        // 2. Fetch Link from Your Vercel API
        let finalLink = null;
        try {
            // ඔයාගේ අලුත් API එක මෙතනට දැම්මා
            const apiUrl = `https://api-site-x-by-manul.vercel.app/convert?mp3=${encodeURIComponent(video.url)}&apikey=Manul-Official`;
            const response = await axios.get(apiUrl);

            // API Response එකේ structure එක අනුව ලින්ක් එක ලබා ගැනීම
            // සටහන: ඔයාගේ API එකේ JSON එකේ 'download_url' හෝ 'result' තිබේ නම් එය මෙතන වෙනස් කරන්න
            if (response.data && response.data.status) {
                finalLink = response.data.result.download_url;
            } else if (response.data.download_url) {
                finalLink = response.data.download_url;
            }
        } catch (e) {
            console.log("Manul API Failed, trying Backup...");
            // Backup API (වැඩේ නතර නොවී ඉන්න backup එකකුත් තියමු)
            const backupUrl = `https://api.giftedtech.my.id/api/download/dlmp3?url=${encodeURIComponent(video.url)}&apikey=gifted`;
            const { data } = await axios.get(backupUrl);
            finalLink = data.result?.download_url;
        }

        if (!finalLink) throw new Error("Could not fetch download link.");

        // 3. Send Final Audio
        await bot.sendMessage(from, { 
            audio: { url: finalLink }, 
            mimetype: "audio/mpeg", 
            ptt: false 
        }, { quoted: mek });

        await m.react("✅");

    } catch (e) {
        console.log("SONG ERROR:", e);
        reply("❌ *Download Error:* " + e.message);
    }
});
