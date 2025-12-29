const { cmd } = require("../command");
const yts = require("yt-search");
const axios = require('axios');
const config = require("../config");

// --- 🛠️ YouTube ID Extraction ---
const getYouTubeID = (url) => {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/live\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
};

// --- 🛠️ Unified Download Logic ---
async function downloadYoutube(url, format, zanta, from, mek, reply, data, settings) {
    const botName = settings.botName || config.DEFAULT_BOT_NAME || "ZANTA-MD";

    // ⏱️ Limit: 15 Mins (900 seconds) - RAM එක බේරා ගැනීමට
    if (data.seconds > 900) { 
        return reply(`⚠️ *වීඩියෝව දිග වැඩියි (Duration: ${data.timestamp}). කරුණාකර විනාඩි 15කට අඩු වීඩියෝ ලබා දෙන්න.*`);
    }

    const loading = await zanta.sendMessage(from, { text: `📥 *Downloading ${format.toUpperCase()}...*\n\n🎬 *Title:* ${data.title}\n⏱️ *Duration:* ${data.timestamp}` }, { quoted: mek });

    try {
        // 🚀 Fast API: යූටියුබ් බාගත කිරීම සඳහා දැනට ස්ථාවර API එකක් (DarkYubi API)
        const apiUrl = `https://api.giftedtech.my.id/api/download/dl?url=${encodeURIComponent(url)}`;
        const res = await axios.get(apiUrl);

        if (!res.data || !res.data.success || !res.data.result) {
            throw new Error("API failed");
        }

        const dlResult = res.data.result;
        const dlLink = format === 'mp4' ? dlResult.video_url : dlResult.audio_url;

        if (format === 'mp4') {
            await zanta.sendMessage(from, { 
                video: { url: dlLink }, 
                caption: `🎬 *Title:* ${data.title}\n\n> *© ${botName}*`,
                mimetype: 'video/mp4' 
            }, { quoted: mek });
        } else {
            await zanta.sendMessage(from, { 
                audio: { url: dlLink }, 
                mimetype: 'audio/mpeg',
                fileName: `${data.title}.mp3`
            }, { quoted: mek });
        }

        return await zanta.sendMessage(from, { text: `✅ *Success!*`, edit: loading.key });

    } catch (e) {
        console.error("YT Download Error:", e);
        // --- Alternative API (Fallback) ---
        try {
            const fallbackUrl = `https://api.vreden.my.id/api/ytmp${format === 'mp4' ? '4' : '3'}?url=${encodeURIComponent(url)}`;
            const fbRes = await axios.get(fallbackUrl);
            const fbLink = fbRes.data.result.download.url || fbRes.data.result.url;

            if (format === 'mp4') {
                await zanta.sendMessage(from, { video: { url: fbLink }, caption: `*${data.title}*\n\n> *© ${botName}*` }, { quoted: mek });
            } else {
                await zanta.sendMessage(from, { audio: { url: fbLink }, mimetype: 'audio/mpeg' }, { quoted: mek });
            }
            return await zanta.sendMessage(from, { text: `✅ *Success (via FB)!*`, edit: loading.key });
        } catch (err) {
            return await zanta.sendMessage(from, { text: `❌ *Error:* සොයාගත නොහැකි විය. පසුව උත්සාහ කරන්න.`, edit: loading.key });
        }
    }
}

// --- 🎞️ VIDEO Command ---
cmd({
    pattern: "video",
    alias: ["ytmp4", "vid"],
    react: "🎥",
    category: "download",
    filename: __filename,
}, async (zanta, mek, m, { from, reply, q, userSettings }) => {
    if (!q) return reply("❌ *YouTube ලින්ක් එකක් හෝ නමක් ලබා දෙන්න.*");
    try {
        const settings = userSettings || global.CURRENT_BOT_SETTINGS || {};
        const search = await yts(q);
        const video = search.videos[0];
        if (!video) return reply("❌ *වීඩියෝව සොයාගත නොහැකි විය.*");
        await downloadYoutube(video.url, 'mp4', zanta, from, mek, reply, video, settings);
    } catch (e) { reply("❌ දෝෂයකි."); }
});

// --- 🎶 SONG Command ---
cmd({
    pattern: "song",
    alias: ["ytmp3", "audio"],
    react: "🎶",
    category: "download",
    filename: __filename,
}, async (zanta, mek, m, { from, reply, q, userSettings }) => {
    if (!q) return reply("❌ *YouTube ලින්ක් එකක් හෝ නමක් ලබා දෙන්න.*");
    try {
        const settings = userSettings || global.CURRENT_BOT_SETTINGS || {};
        const search = await yts(q);
        const video = search.videos[0];
        if (!video) return reply("❌ *සින්දුව සොයාගත නොහැකි විය.*");
        await downloadYoutube(video.url, 'mp3', zanta, from, mek, reply, video, settings);
    } catch (e) { reply("❌ දෝෂයකි."); }
});
