const { cmd } = require("../command");
const axios = require("axios");
const yts = require("yt-search");
const { PassThrough } = require('stream');
const ffmpeg = require('fluent-ffmpeg');

// --- ⚙️ FFmpeg Conversion (Standard WhatsApp Format) ---
async function convertToWhatsAppCompatible(inputBuffer) {
    return new Promise((resolve, reject) => {
        const inputStream = new PassThrough();
        const outputStream = new PassThrough();
        const chunks = [];
        inputStream.end(inputBuffer);

        ffmpeg(inputStream)
            .audioCodec('libmp3lame')
            .audioBitrate('128k')
            .audioFrequency(44100)
            .format('mp3')
            .audioChannels(2)
            .on('error', (err) => reject(err))
            .on('end', () => resolve(Buffer.concat(chunks)))
            .pipe(outputStream, { end: true });

        outputStream.on('data', (chunk) => chunks.push(chunk));
    });
}

// --- 🎵 SONG COMMAND ---
cmd({
    pattern: "song",
    alias: ["yta", "mp3", "play"],
    react: "🎧",
    desc: "Download YouTube MP3 (Fast & Strong)",
    category: "download",
    filename: __filename,
}, async (bot, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("🎧 *ZANTA-MD SONG SEARCH*\n\nExample: .song alone");

        // 1. YouTube Search
        const search = await yts(q);
        const video = search.videos[0];
        if (!video) return reply("❌ No results found on YouTube.");

        // 🎨 Awesome Ascii Art & Style Text
        let msg = `
🎵 *ZANTA-MD AUDIO PLAYER* 🎵

   +----------+----------+
      ▶  ●────────── 03:15
   +----------+----------+

📝 *Title:* ${video.title}
👤 *Artist:* ${video.author.name}
⏱️ *Duration:* ${video.timestamp}
🔗 *Link:* ${video.url}

> *📥 Downloading your request, please wait...*
`;

        await bot.sendMessage(from, { image: { url: video.thumbnail }, caption: msg }, { quoted: mek });

        // 2. Try Fetching Link from API
        let finalLink = null;
        try {
            const apiUrl = `https://anju-md-api.vercel.app/api/new/ytmp3?apikey=newytmp3&url=${video.url}`;
            const { data } = await axios.get(apiUrl);
            finalLink = data.downloadLink;
        } catch (e) {
            // Backup API if primary fails
            const backupUrl = `https://api.giftedtech.my.id/api/download/dlmp3?url=${encodeURIComponent(video.url)}&apikey=gifted`;
            const { data } = await axios.get(backupUrl);
            finalLink = data.result?.download_url;
        }

        if (!finalLink) throw new Error("Could not fetch download link from any API.");

        // 3. Download Buffer & Convert via FFmpeg
        const res = await axios.get(finalLink, { 
            responseType: 'arraybuffer',
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        const inputBuffer = Buffer.from(res.data);
        const compatibleBuffer = await convertToWhatsAppCompatible(inputBuffer);

        // 4. Send Final Audio
        await bot.sendMessage(from, { 
            audio: compatibleBuffer, 
            mimetype: "audio/mpeg", 
            ptt: false 
        }, { quoted: mek });

        await m.react("✅");

    } catch (e) {
        console.log("SONG ERROR:", e);
        reply("❌ *Download Error:* " + e.message);
    }
});
