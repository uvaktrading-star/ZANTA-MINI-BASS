const { cmd } = require("../command");
const yts = require("yt-search");
const axios = require('axios');
const config = require("../config");

// --- 🛠️ YouTube ID Regex ---
function getYouTubeID(url) {
    let regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/live\/)([^"&?\/\s]{11})/;
    let match = url.match(regex);
    return (match && match[1]) ? match[1] : null;
}

// --- 🛠️ Download Function with Limits ---
async function downloadYoutube(url, format, zanta, from, mek, reply, data, settings) {
    const botName = settings.botName || config.DEFAULT_BOT_NAME || "ZANTA-MD";

    // ⏱️ කාලය පරීක්ෂා කිරීම (විනාඩි 10 සීමාව)
    if (data.seconds > 600) { 
        return reply(`⚠️ *මෙම වීඩියෝව විනාඩි 10 කට වඩා වැඩි බැවින් (Duration: ${data.timestamp}) මෙය බාගත කළ නොහැක.*`);
    }

    let tempMsg;
    try {
        tempMsg = await reply(`*📥 Downloading ${format.toUpperCase()}...*\n\n🎬 *Title:* ${data.title}\n⏱️ *Duration:* ${data.timestamp}\n🎞️ *Quality:* 480p`);

        let downloadUrl = "";

        // 🚀 ක්‍රමය 1: Vreden API (YT MP4/MP3)
        try {
            const type = format === 'mp4' ? 'ytmp4' : 'ytmp3';
            const vredenApi = `https://api.vreden.my.id/api/${type}?url=${encodeURIComponent(url)}`;
            const res = await axios.get(vredenApi);

            // API එකෙන් එන data structure එක අනුව මේක වෙනස් වෙන්න පුළුවන්
            if (res.data && res.data.result && res.data.result.download) {
                downloadUrl = res.data.result.download.url;
            } else if (res.data && res.data.url) {
                downloadUrl = res.data.url;
            }
        } catch (e) { console.log("Vreden error..."); }

        // 🚀 ක්‍රමය 2: Fallback (නවතම ස්ථාවර API එකක්)
        if (!downloadUrl) {
            try {
                const fallback = await axios.get(`https://api.agungandhika.com/api/youtube?url=${encodeURIComponent(url)}&type=${format}`);
                if (fallback.data && fallback.data.result) {
                    downloadUrl = fallback.data.result.url || fallback.data.result.dl_link;
                }
            } catch (e) { console.log("Fallback error..."); }
        }

        if (!downloadUrl) throw new Error("Link not found.");

        if (format === 'mp4') {
            await zanta.sendMessage(from, { 
                video: { url: downloadUrl }, 
                caption: `*✅ Download Complete!*\n\n🎬 *Title:* ${data.title}\n🎞️ *Quality:* 480p\n\n> *© ${botName}*`,
                mimetype: 'video/mp4' 
            }, { quoted: mek });
        } else {
            await zanta.sendMessage(from, { 
                audio: { url: downloadUrl }, 
                mimetype: 'audio/mpeg',
                fileName: `${data.title}.mp3`
            }, { quoted: mek });
        }

        return await zanta.sendMessage(from, { text: `*වැඩේ හරි! 🙃✅*`, edit: tempMsg.key });

    } catch (e) {
        console.error(e);
        if (tempMsg) await zanta.sendMessage(from, { text: `❌ *Error:* බාගත කිරීම අසාර්ථක විය. පසුව උත්සාහ කරන්න.`, edit: tempMsg.key });
    }
}

// --- 🎞️ YT MP4 Command ---
cmd({
    pattern: "video",
    alias: ["ytmp4", "vid"],
    react: "🎥",
    desc: "Download YouTube videos",
    category: "download",
    filename: __filename,
}, async (zanta, mek, m, { from, reply, q, userSettings }) => {
    if (!q) return reply("❌ *YouTube ලින්ක් එකක් හෝ නමක් ලබා දෙන්න.*");
    try {
        const settings = userSettings || global.CURRENT_BOT_SETTINGS;
        let videoInfo;
        let videoId = getYouTubeID(q);

        if (videoId) {
            videoInfo = await yts({ videoId: videoId });
        } else {
            const search = await yts(q);
            videoInfo = search.videos[0];
        }

        if (!videoInfo) return reply("❌ *වීඩියෝව සොයාගත නොහැකි විය.*");
        await downloadYoutube(videoInfo.url, 'mp4', zanta, from, mek, reply, videoInfo, settings);
    } catch (e) { reply("❌ දෝෂයකි."); }
});

// --- 🎶 YT MP3 Command ---
cmd({
    pattern: "song",
    alias: ["ytmp3", "audio"],
    react: "🎶",
    desc: "Download YouTube songs",
    category: "download",
    filename: __filename,
}, async (zanta, mek, m, { from, reply, q, userSettings }) => {
    if (!q) return reply("❌ *YouTube ලින්ක් එකක් හෝ නමක් ලබා දෙන්න.*");
    try {
        const settings = userSettings || global.CURRENT_BOT_SETTINGS;
        let videoInfo;
        let videoId = getYouTubeID(q);

        if (videoId) {
            videoInfo = await yts({ videoId: videoId });
        } else {
            const search = await yts(q);
            videoInfo = search.videos[0];
        }

        if (!videoInfo) return reply("❌ *සින්දුව සොයාගත නොහැකි විය.*");
        await downloadYoutube(videoInfo.url, 'mp3', zanta, from, mek, reply, videoInfo, settings);
    } catch (e) { reply("❌ දෝෂයකි."); }
});
