const { cmd } = require("../command");
const { ytmp3, ytmp4 } = require("sadaslk-dlcore");
const yts = require("yt-search");

// YouTube සෙවුම් function එක
async function getYoutube(query) {
    const isUrl = /(youtube\.com|youtu\.be)/i.test(query);
    if (isUrl) {
        const id = query.split("v=")[1]?.split("&")[0] || query.split("/").pop();
        const info = await yts({ videoId: id });
        return info;
    }
    const search = await yts(query);
    return search.videos.length ? search.videos[0] : null;
}

// --- 🎵 SONG COMMAND ---
cmd({
    pattern: "song",
    alias: ["yta", "mp3"],
    react: "🎵",
    desc: "Download YouTube MP3",
    category: "download",
    filename: __filename,
}, async (bot, mek, m, { from, q, reply, prefix, userSettings }) => {
    try {
        if (!q) return reply("🎵 Send song name or YouTube link");

        const settings = userSettings || global.CURRENT_BOT_SETTINGS || {};
        const isButtonsOn = settings.buttons === 'true';
        const botName = settings.botName || "ZANTA-MD";

        reply("🔎 Searching YouTube...");
        const video = await getYoutube(q);
        if (!video) return reply("❌ No results found");

        const caption = `📝 *Title:* ${video.title}\n` +
                        `👤 *Channel:* ${video.author.name}\n` +
                        `⏱ *Duration:* ${video.timestamp}\n` +
                        `🔗 *Link:* ${video.url}`;

        if (isButtonsOn) {
            // --- අලුත් Baileys Button Logic එක (Image සමඟ) ---
            const buttons = [
                { buttonId: `${prefix}ytsong_audio ${video.url}`, buttonText: { displayText: "🎶 AUDIO" }, type: 1 },
                { buttonId: `${prefix}ytsong_doc ${video.url}`, buttonText: { displayText: "📂 DOCUMENT" }, type: 1 }
            ];

            const buttonMessage = {
                image: { url: video.thumbnail },
                caption: caption,
                footer: `© ${botName}`,
                buttons: buttons,
                headerType: 4
            };

            return await bot.sendMessage(from, buttonMessage, { quoted: mek });
        } else {
            await bot.sendMessage(from, { image: { url: video.thumbnail }, caption: caption + "\n\n> *📥 Downloading Audio...*" }, { quoted: mek });
            const data = await ytmp3(video.url);
            if (!data || !data.url) return reply("❌ Download failed.");
            return await bot.sendMessage(from, { audio: { url: data.url }, mimetype: "audio/mpeg" }, { quoted: mek });
        }
    } catch (e) {
        console.log("SONG ERROR:", e);
        reply("❌ Error while processing request");
    }
});

// --- 🎬 VIDEO COMMAND ---
cmd({
    pattern: "ytmp4",
    alias: ["ytv", "video"],
    desc: "Download YouTube MP4",
    category: "download",
    filename: __filename,
}, async (bot, mek, m, { from, q, reply, prefix, userSettings }) => {
    try {
        if (!q) return reply("🎬 Send video name or link");

        const settings = userSettings || global.CURRENT_BOT_SETTINGS || {};
        const isButtonsOn = settings.buttons === 'true';
        const botName = settings.botName || "ZANTA-MD";

        reply("🔎 Searching YouTube...");
        const video = await getYoutube(q);
        if (!video) return reply("❌ No results found");

        const caption = `📝 *Title:* ${video.title}\n` +
                        `👤 *Channel:* ${video.author.name}\n` +
                        `⏱ *Duration:* ${video.timestamp}\n\n` +
                        `🔗 *Link:* ${video.url}`;

        if (isButtonsOn) {
            const buttons = [
                { buttonId: `${prefix}vdl_vid 360|${video.url}`, buttonText: { displayText: "📽️ 360p" }, type: 1 },
                { buttonId: `${prefix}vdl_vid 720|${video.url}`, buttonText: { displayText: "🎥 720p" }, type: 1 }
            ];

            const buttonMessage = {
                image: { url: video.thumbnail },
                caption: caption,
                footer: `© ${botName}`,
                buttons: buttons,
                headerType: 4
            };

            return await bot.sendMessage(from, buttonMessage, { quoted: mek });
        } else {
            await bot.sendMessage(from, { image: { url: video.thumbnail }, caption: caption + "\n\n> *📥 Downloading Video (360p)...*" }, { quoted: mek });

            const downloadData = await ytmp4(video.url, "360");
            // ප්ලේ වෙන්න නම් direct mp4 link එකක්ම අවශ්‍යයි
            const finalUrl = downloadData.result || downloadData.url || downloadData.dl_url;

            if (!finalUrl) return reply("❌ Download failed. Try again.");

            return await bot.sendMessage(from, {
                video: { url: finalUrl },
                mimetype: 'video/mp4',
                caption: `✅ *Title:* ${video.title}\n*ZANTA-MD*`,
                fileName: `${video.title}.mp4` // File name එකක් දීමෙන් playability වැඩි වේ
            }, { quoted: mek });
        }
    } catch (e) {
        console.log("YTMP4 ERROR:", e);
        reply("❌ Error while processing video.");
    }
});

// --- 📥 INTERNAL VIDEO HANDLER (FIXED) ---
cmd({ pattern: "vdl_vid", dontAddCommandList: true }, async (bot, mek, m, { from, q, reply }) => {
    if (!q) return;
    try {
        const [qualityInfo, ...urlParts] = q.split("|");
        const urlText = urlParts.join("|");
        const urlMatch = urlText.match(/https?:\/\/[^\s]+/);
        const url = urlMatch ? urlMatch[0] : urlText.trim();
        const quality = qualityInfo.replace(/[^0-9]/g, "") || "360";

        const downloadData = await ytmp4(url, quality);
        const finalUrl = downloadData.result || downloadData.url || downloadData.dl_url;

        if (!finalUrl) return reply("❌ Could not fetch video link.");

        await bot.sendMessage(from, { 
            video: { url: finalUrl }, 
            mimetype: 'video/mp4', 
            caption: `✅ Quality: ${quality}p\n*ZANTA-MD*` 
        }, { quoted: mek });
    } catch (e) { 
        console.log("INTERNAL VIDEO ERROR:", e);
        reply("❌ Video service error."); 
    }
});
