const { cmd } = require("../command");
const yts = require("yt-search");
const axios = require('axios');

// --- 🛠️ YouTube ID Regex ---
function getYouTubeID(url) {
    let regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/live\/)([^"&?\/\s]{11})/;
    let match = url.match(regex);
    return (match && match[1]) ? match[1] : null;
}

// --- 🛠️ Download Function with Limits ---
async function downloadYoutube(url, format, zanta, from, mek, reply, data) {
    const botName = global.CURRENT_BOT_SETTINGS?.botName || "ZANTA-MD";
    
    // ⏱️ කාලය පරීක්ෂා කිරීම (විනාඩි 10 සීමාව)
    // data.seconds යනු yt-search මගින් දෙන වීඩියෝවේ මුළු තත්පර ගණනයි.
    if (data.seconds > 600) { 
        return reply(`⚠️ *මෙම වීඩියෝව විනාඩි 10 කට වඩා වැඩි බැවින් (Duration: ${data.timestamp}) Render Free Tier එක සුරක්ෂිත කිරීමට මෙය බාගත කළ නොහැක.*`);
    }

    let tempMsg;
    try {
        tempMsg = await reply(`*📥 Downloading ${format.toUpperCase()}...*\n\n🎬 *Title:* ${data.title}\n⏱️ *Duration:* ${data.timestamp}\n🎞️ *Quality:* 480p`);

        let downloadUrl = "";

        // 🚀 ක්‍රමය 1: Vreden API (480p Quality එකත් සමඟ)
        try {
            const vredenApi = `https://api.vreden.my.id/api/yt${format === 'mp4' ? 'mp4' : 'mp3'}?url=${encodeURIComponent(url)}&quality=480`;
            const res = await axios.get(vredenApi);
            if (res.data && res.data.status === 200 && res.data.result.download.url) {
                downloadUrl = res.data.result.download.url;
            }
        } catch (e) { console.log("Vreden error..."); }

        // 🚀 ක්‍රමය 2: Fallback (Gifted API)
        if (!downloadUrl) {
            try {
                const giftedApi = `https://api.giftedtech.my.id/api/download/dl?url=${encodeURIComponent(url)}`;
                const res = await axios.get(giftedApi);
                if (res.data && res.data.success) {
                    downloadUrl = (format === 'mp4') ? res.data.result.video_url : res.data.result.audio_url;
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
        if (tempMsg) await zanta.sendMessage(from, { text: `❌ *Error:* බාගත කිරීම අසාර්ථක විය.`, edit: tempMsg.key });
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
}, async (zanta, mek, m, { from, reply, q }) => {
    if (!q) return reply("❌ *YouTube ලින්ක් එකක් හෝ නමක් ලබා දෙන්න.*");
    try {
        let videoInfo;
        let videoId = getYouTubeID(q);
        if (videoId) {
            videoInfo = await yts({ videoId: videoId });
        } else {
            const search = await yts(q);
            videoInfo = search.videos[0];
        }
        if (!videoInfo) return reply("❌ *වීඩියෝව සොයාගත නොහැකි විය.*");
        await downloadYoutube(videoInfo.url, 'mp4', zanta, from, mek, reply, videoInfo);
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
}, async (zanta, mek, m, { from, reply, q }) => {
    if (!q) return reply("❌ *YouTube ලින්ක් එකක් හෝ නමක් ලබා දෙන්න.*");
    try {
        let videoInfo;
        let videoId = getYouTubeID(q);
        if (videoId) {
            videoInfo = await yts({ videoId: videoId });
        } else {
            const search = await yts(q);
            videoInfo = search.videos[0];
        }
        if (!videoInfo) return reply("❌ *සින්දුව සොයාගත නොහැකි විය.*");
        await downloadYoutube(videoInfo.url, 'mp3', zanta, from, mek, reply, videoInfo);
    } catch (e) { reply("❌ දෝෂයකි."); }
});
