const { cmd } = require("../command");
const axios = require("axios");
const yts = require("yt-search");
const config = require("../config");

cmd({
    pattern: "song",
    alias: ["yta", "mp3", "play"],
    react: "🎧",
    desc: "Download YouTube MP3 via Manul Vercel API",
    category: "download",
    filename: __filename,
}, async (bot, mek, m, { from, q, reply, userSettings }) => {
    try {
        if (!q) return reply("🎧 *ZANTA-MD SONG SEARCH*\n\nExample: .song alone");

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

        await bot.sendMessage(from, { image: { url: video.thumbnail }, caption: msg }, { quoted: mek });

        let finalLink = null;
        try {
            // --- 🚀 MANUL API CALL ---
            const apiUrl = `https://api-site-x-by-manul.vercel.app/convert?mp3=${encodeURIComponent(video.url)}&apikey=Manul-Official`;
            const response = await axios.get(apiUrl);

            // ඔයා එවපු අලුත් JSON එකේ දත්ත තියෙන්නේ මෙහෙමයි:
            // response.data.data.url
            if (response.data && response.data.status === true && response.data.data) {
                finalLink = response.data.data.url; 
            }
        } catch (e) {
            console.log("Manul API Error:", e.message);
        }

        // --- 🔄 BACKUP API (Manul API එක වැඩ නොකළොත් පමණි) ---
        if (!finalLink) {
            try {
                const backupUrl = `https://api.giftedtech.my.id/api/download/dlmp3?url=${encodeURIComponent(video.url)}&apikey=gifted`;
                const { data } = await axios.get(backupUrl);
                finalLink = data.result?.download_url;
            } catch (e) {
                console.log("Backup Failed.");
            }
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
