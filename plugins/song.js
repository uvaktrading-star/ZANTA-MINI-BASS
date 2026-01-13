const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp3 } = require("@vreden/youtube_scraper");
const config = require("../config");
const axios = require("axios");

cmd({
    pattern: "song",
    react: "🎶",
    desc: "Download MP3 Songs with full details UI.",
    category: "download",
    filename: __filename,
}, async (zanta, mek, m, { from, reply, q, userSettings }) => {
    try {
        if (!q) return reply("❌ *කරුණාකර සින්දුවේ නම හෝ YouTube ලින්ක් එක ලබා දෙන්න.*");

        const loading = await zanta.sendMessage(from, { text: "🔍 *Searching your song...*" }, { quoted: mek });

        const search = await yts(q);
        const data = search.videos[0];
        if (!data) return await zanta.sendMessage(from, { text: "❌ *සින්දුව සොයාගත නොහැකි විය.*", edit: loading.key });

        // DATABASE BOT NAME
        const settings = userSettings || global.CURRENT_BOT_SETTINGS || {};
        const botName = settings.botName || config.DEFAULT_BOT_NAME || "ZANTA-MD";

        // ලෝගෝ එක Buffer එකක් විදියට මෙතැනදී ගන්නවා
        let logoResponse = await axios.get("https://github.com/Akashkavindu/ZANTA_MD/blob/main/images/WhatsApp%20Image%202025-12-29%20at%209.28.43%20AM.jpeg?raw=true", { responseType: 'arraybuffer' });
        let logoBuffer = Buffer.from(logoResponse.data, 'binary');

        if (data.seconds > 3600) {
            return await zanta.sendMessage(from, { text: "⏳ *විනාඩි 60 ට වැඩි Audio දැනට සහය නොදක්වයි.*", edit: loading.key });
        }

        // --- 🎨 YOUR REQUESTED CAPTION STYLE ---
        let stylishDesc = `🎶 *|${botName.toUpperCase()} SONG PLAYER|* 🎶
        
🎬 *Title:* ${data.title}
⏱️ *Duration:* ${data.timestamp}
👤 *Author:* ${data.author.name}
📅 *Uploaded:* ${data.ago}
👀 *Views:* ${data.views.toLocaleString()}

> *©️ ${botName.toUpperCase()}*`;

        // --- 🖼️ UI WITH WHATSAPP BUSINESS CARD ---
        await zanta.sendMessage(from, { 
            image: { url: data.thumbnail }, 
            caption: stylishDesc,       
        }, { quoted: mek });

        const songData = await ytmp3(data.url, "192");

        if (!songData || !songData.download || !songData.download.url) {
            return await zanta.sendMessage(from, { text: "❌ *ඩවුන්ලෝඩ් ලින්ක් එක ලබා ගැනීමට නොහැක.*", edit: loading.key });
        }

        // --- AUDIO FILE UPLOAD ---
        await zanta.sendMessage(from, {
            audio: { url: songData.download.url },
            mimetype: "audio/mpeg",
            fileName: `${data.title}.mp3`,
            contextInfo: {
            }
        }, { quoted: mek });

        await zanta.sendMessage(from, { text: "✅ *Download Complete!*", edit: loading.key });
        await m.react("✅");

    } catch (e) {
        console.error(e);
        reply(`❌ *Error:* ${e.message}`);
    }
});

// ---------------------------------------------------------------------------
// GSONG COMMAND (Send to specific Groups)
// ---------------------------------------------------------------------------
cmd({

    pattern: "gsong",

    desc: "Send song to groups (Simple Mode)",

    category: "download",

    use: ".gsong <group_jid> <song_name>",

    filename: __filename

},

async (zanta, mek, m, { from, q, reply, isOwner, userSettings }) => {

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



        if (data.seconds > 2400) { 

            return reply(`⚠️ *සින්දුව ගොඩක් දිග වැඩියි!* (Max: 40 Mins)`);

        }



        const response = await axios.get(data.thumbnail, { responseType: 'arraybuffer' });

        const imgBuffer = Buffer.from(response.data, 'binary');



        const timeLine = "───●──────────"; 

        const imageCaption = `✨ *${botName.toUpperCase()} SONG DOWNLOADER* ✨\n\n` +

                             `📝 *Title:* ${data.title}\n` +

                             `🕒 *Duration:* ${data.timestamp}\n\n` +

                             `   ${timeLine}\n` +

                             `   ⇆ㅤㅤ◁ㅤ❚❚ㅤ▷ㅤ↻`;



        await zanta.sendMessage(targetJid, { 

            image: imgBuffer, 

            caption: imageCaption 

        });



        await m.react("📥");



        const songData = await ytmp3(data.url, "128");

        if (!songData || !songData.download || !songData.download.url) {

            return reply("❌ Download error.");

        }



        await zanta.sendMessage(targetJid, { 

            audio: { url: songData.download.url }, 

            mimetype: 'audio/mpeg', 

            ptt: false, 

            fileName: `${data.title}.mp3`

        }, { quoted: null });



        await m.react("✅");

        await reply(`🚀 *Successfully Shared!*`);



    } catch (e) {

        console.error("GSong Error:", e);

        reply(`❌ Error: ${e.message}`);

    }

});
