const { cmd } = require("../command");
const yts = require("yt-search");
const axios = require("axios");

// Search results මතක තබා ගන්නා Map එක
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

        let resultText = `🎬 *ZANTA-MD YT SEARCH*\n\n`;
        let linksArray = [];

        results.forEach((v, i) => {
            resultText += `*${i + 1}. ${v.title}*\n⌚ ${v.timestamp}\n📥 Reply: *${i + 1}*\n\n`;
            linksArray.push({ url: v.url, title: v.title });
        });

        resultText += `> *වීඩියෝව බාගත කිරීමට අදාළ අංකය Reply කරන්න.*`;

        // Thumbnail එක යැවීම (Error handle කර ඇත)
        const sentMsg = await zanta.sendMessage(from, {
            image: { url: results[0].thumbnail },
            caption: resultText
        }, { quoted: mek }).catch(async () => {
            return await zanta.sendMessage(from, { text: resultText }, { quoted: mek });
        });

        // Reply handler එක සඳහා දත්ත ගබඩා කිරීම
        ytsLinks.set(sentMsg.key.id, linksArray);
        setTimeout(() => ytsLinks.delete(sentMsg.key.id), 10 * 60 * 1000);

        await zanta.sendMessage(from, { delete: loading.key });

    } catch (err) {
        console.error(err);
        reply("❌ සෙවීමේදී දෝෂයක් සිදු විය.");
    }
});

module.exports = { ytsLinks };
