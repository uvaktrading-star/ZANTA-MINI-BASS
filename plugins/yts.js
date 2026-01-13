const { cmd } = require("../command");
const yts = require("yt-search");
const fs = require("fs-extra");

// සර්ච් රිසල්ට් මතක තබා ගැනීමට (Global Variable)
if (!global.ytsLinks) {
    global.ytsLinks = new Map();
}

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
            linksArray.push({ url: v.url, title: v.title, seconds: v.seconds });
        });

        resultText += `> *වීඩියෝව බාගත කිරීමට අදාළ අංකය Reply කරන්න.*`;

        const sentMsg = await zanta.sendMessage(from, {
            image: { url: results[0].thumbnail },
            caption: resultText
        }, { quoted: mek });

        // දත්ත ගබඩා කිරීම
        global.ytsLinks.set(sentMsg.key.id, linksArray);
        
        // විනාඩි 10 කින් දත්ත මකා දැමීම
        setTimeout(() => global.ytsLinks.delete(sentMsg.key.id), 10 * 60 * 1000);

        await zanta.sendMessage(from, { delete: loading.key });

    } catch (err) {
        console.error(err);
        reply("❌ සෙවීමේදී දෝෂයක් සිදු විය.");
    }
});
