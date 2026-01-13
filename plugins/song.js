const { cmd } = require("../command");
const yts = require("yt-search");
const YTDlpWrap = require("yt-dlp-wrap").default;
const ytDlpWrap = new YTDlpWrap('/usr/local/bin/yt-dlp'); // VPS එකේ yt-dlp binary path එක
const config = require("../config");
const fs = require("fs-extra");

// --- SONG COMMAND ---
cmd({
    pattern: "song",
    react: "🎶",
    desc: "Download MP3 Songs with yt-dlp.",
    category: "download",
    filename: __filename,
}, async (zanta, mek, m, { from, reply, q, userSettings }) => {
    try {
        if (!q) return reply("❌ *කරුණාකර සින්දුවේ නම හෝ YouTube ලින්ක් එක ලබා දෙන්න.*");

        const loading = await zanta.sendMessage(from, { text: "🔍 *Searching your song...*" }, { quoted: mek });

        const search = await yts(q);
        const data = search.videos[0];
        if (!data) return await zanta.sendMessage(from, { text: "❌ *සින්දුව සොයාගත නොහැකි විය.*", edit: loading.key });

        const settings = userSettings || global.CURRENT_BOT_SETTINGS || {};
        const botName = settings.botName || config.DEFAULT_BOT_NAME || "ZANTA-MD";

        if (data.seconds > 3600) {
            return await zanta.sendMessage(from, { text: "⏳ *විනාඩි 60 ට වැඩි Audio දැනට සහය නොදක්වයි.*", edit: loading.key });
        }

        let stylishDesc = `🎶 *|${botName.toUpperCase()} SONG PLAYER|* 🎶
        
🎬 *Title:* ${data.title}
⏱️ *Duration:* ${data.timestamp}
👤 *Author:* ${data.author.name}
📅 *Uploaded:* ${data.ago}

> *©️ ${botName.toUpperCase()}*`;

        await zanta.sendMessage(from, { 
            image: { url: data.thumbnail }, 
            caption: stylishDesc,        
        }, { quoted: mek });

        const fileName = `./${data.videoId}.mp3`;

        // yt-dlp භාවිතයෙන් Audio එක බාගැනීම
        let ytDlpEventEmitter = ytDlpWrap
            .exec([
                data.url,
                "-f", "bestaudio/best",
                "--extract-audio",
                "--audio-format", "mp3",
                "--audio-quality", "0",
                "-o", fileName,
            ])
            .on("error", async (err) => {
                console.error(err);
                await zanta.sendMessage(from, { text: `❌ Download Error: ${err.message}`, edit: loading.key });
            })
            .on("close", async () => {
                // Audio එක WhatsApp වෙත යැවීම
                await zanta.sendMessage(from, {
                    audio: { url: fileName },
                    mimetype: "audio/mpeg",
                    fileName: `${data.title}.mp3`
                }, { quoted: mek });

                await zanta.sendMessage(from, { delete: loading.key });
                await m.react("✅");
                if (fs.existsSync(fileName)) fs.unlinkSync(fileName); 
            });

    } catch (e) {
        console.error(e);
        reply(`❌ *Error:* ${e.message}`);
    }
});

// --- GSONG COMMAND ---
cmd({
    pattern: "gsong",
    desc: "Send song to groups (YT-DLP Mode)",
    category: "download",
    use: ".gsong <group_jid> <song_name>",
    filename: __filename
}, async (zanta, mek, m, { from, q, reply, isOwner, userSettings }) => {
    try {
        if (!isOwner) return reply("❌ අයිතිකරුට පමණි.");
        if (!q) return reply("⚠️ භාවිතා කරන ආකාරය: .gsong <jid> <song_name>");

        const args = q.split(" ");
        const targetJid = args[0].trim(); 
        const songName = args.slice(1).join(" "); 

        if (!targetJid.includes("@")) return reply("⚠️ කරුණාකර නිවැරදි Group JID එකක් ලබා දෙන්න.");

        const settings = userSettings || global.CURRENT_BOT_SETTINGS || {};
        const botName = settings.botName || "ZANTA-MD";

        await m.react("🔍");

        const search = await yts(songName);
        const data = search.videos[0];
        if (!data) return reply("❌ සින්දුව සොයාගත නොහැකි විය.");

        const imageCaption = `✨ *${botName.toUpperCase()} SONG DOWNLOADER* ✨\n\n` +
                             `📝 *Title:* ${data.title}\n` +
                             `🕒 *Duration:* ${data.timestamp}\n\n` +
                             `───●──────────\n` +
                             `⇆ㅤㅤ◁ㅤ❚❚ㅤ▷ㅤ↻`;

        await zanta.sendMessage(targetJid, { 
            image: { url: data.thumbnail }, 
            caption: imageCaption 
        });

        await m.react("📥");

        const fileName = `./gsong_${data.videoId}.mp3`;
        
        let ytDlpEventEmitter = ytDlpWrap
            .exec([
                data.url,
                "-f", "bestaudio/best",
                "--extract-audio",
                "--audio-format", "mp3",
                "-o", fileName,
            ])
            .on("close", async () => {
                await zanta.sendMessage(targetJid, { 
                    audio: { url: fileName }, 
                    mimetype: 'audio/mpeg', 
                    ptt: false, 
                    fileName: `${data.title}.mp3`
                }, { quoted: null });

                await m.react("✅");
                await reply(`🚀 *Successfully Shared to ${targetJid}!*`);
                if (fs.existsSync(fileName)) fs.unlinkSync(fileName);
            });

    } catch (e) {
        console.error("GSong Error:", e);
        reply(`❌ Error: ${e.message}`);
    }
});
