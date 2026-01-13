const { cmd } = require("../command");
const yts = require("yt-search");
const ytdl = require("@distube/ytdl-core");
const fs = require("fs-extra");

// සර්ච් රිසල්ට් තාවකාලිකව තබා ගැනීමට
const ytsLinks = new Map();

cmd({
    pattern: "video",
    alias: ["ytmp4"],
    react: "🔎",
    category: "download",
    filename: __filename,
}, async (zanta, mek, m, { from, reply, q }) => {
    try {
        if (!q) return reply("🔍 *මොන වගේ වීඩියෝ එකක්ද සොයන්න ඕනේ?*");

        const loading = await zanta.sendMessage(from, { text: "⌛ *Searching YouTube...*" }, { quoted: mek });
        const search = await yts(q);
        const results = search.videos.slice(0, 10);

        if (!results.length) return await zanta.sendMessage(from, { text: "❌ කිසිදු ප්‍රතිඵලයක් හමු නොවීය.", edit: loading.key });

        let resultText = `🎬 *ZANTA-MD YT VIDEO SEARCH*\n\n`;
        let linksArray = [];

        results.forEach((v, i) => {
            resultText += `*${i + 1}. ${v.title}*\n⌚ ${v.timestamp}\n📥 Reply: *${i + 1}*\n\n`;
            linksArray.push({ url: v.url, title: v.title });
        });

        resultText += `> *වීඩියෝව බාගත කිරීමට අදාළ අංකය Reply කරන්න.*`;

        const sentMsg = await zanta.sendMessage(from, {
            image: { url: results[0].thumbnail },
            caption: resultText
        }, { quoted: mek });

        // දත්ත ගබඩා කිරීම (Message ID එක යතුර ලෙස)
        ytsLinks.set(sentMsg.key.id, linksArray);
        
        // විනාඩි 10 කින් දත්ත මකා දැමීම
        setTimeout(() => ytsLinks.delete(sentMsg.key.id), 10 * 60 * 1000);

        await zanta.sendMessage(from, { delete: loading.key });

    } catch (err) {
        console.error(err);
        reply("❌ සෙවීමේදී දෝෂයක් සිදු විය.");
    }
});

// --- REPLY HANDLING LOGIC ---
// සටහන: මෙය සාමාන්‍යයෙන් ඔයාගේ main event handler එකේ තිබිය යුතුයි. 
// බොට් එකේ 'any-message' හෝ 'messages.upsert' එකේදී මෙය ක්‍රියාත්මක විය යුතුයි.

zanta.ev.on('messages.upsert', async (chatUpdate) => {
    const m = chatUpdate.messages[0];
    if (!m.message || !m.message.extendedTextMessage) return;

    const quotedMsgId = m.message.extendedTextMessage.contextInfo.stanzaId;
    const body = m.message.extendedTextMessage.text || m.message.conversation;

    if (ytsLinks.has(quotedMsgId)) {
        const selection = parseInt(body);
        const links = ytsLinks.get(quotedMsgId);

        if (!isNaN(selection) && selection > 0 && selection <= links.length) {
            const selectedVideo = links[selection - 1];
            const from = m.key.remoteJid;

            await zanta.sendMessage(from, { text: `📥 *Downloading:* ${selectedVideo.title}...` });

            try {
                const videoFile = `./${Date.now()}.mp4`;
                
                // ytdl-core මගින් වීඩියෝව බාගැනීම
                const download = ytdl(selectedVideo.url, { 
                    quality: 'highestvideo',
                    filter: format => format.container === 'mp4' && format.hasAudio && format.hasVideo
                }).pipe(fs.createWriteStream(videoFile));

                download.on('finish', async () => {
                    await zanta.sendMessage(from, {
                        video: { url: videoFile },
                        caption: `✅ *${selectedVideo.title}*`,
                        mimetype: 'video/mp4'
                    }, { quoted: m });

                    fs.unlinkSync(videoFile); // VPS එකෙන් මැකීම
                });

                download.on('error', (err) => {
                    console.error(err);
                    zanta.sendMessage(from, { text: "❌ වීඩියෝව බාගත කිරීමේදී දෝෂයක් සිදු විය." });
                });

            } catch (e) {
                console.error(e);
            }
        }
    }
});

module.exports = { ytsLinks };
