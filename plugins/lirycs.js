const { cmd } = require("../command");
const axios = require("axios");

cmd({
    pattern: "lyrics",
    alias: ["lyric", "සින්දුපද"],
    react: "🎶",
    desc: "Search lyrics for any song.",
    category: "media",
    filename: __filename
}, async (bot, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("🎶 *කරුණාකර සින්දුවක නමක් ලබා දෙන්න!* \n\nExample: .lyrics Lelena");

        await bot.sendMessage(from, { react: { text: "⏳", key: m.key } });

        const API_URL = `https://apis.sandarux.sbs/api/search/lyrics?apikey=darknero&title=${encodeURIComponent(q)}`;
        const { data } = await axios.get(API_URL);

        if (!data.status || !data.result) {
            return reply("❌ එම සින්දුවේ පද පේළි සොයාගත නොහැකි විය.");
        }

        const lyrics = data.result;

        let lyricsMsg = `🎶 *LYRICS SEARCH SERVICE* 🎶\n\n` +
                       `🎵 *Title:* ${lyrics.title}\n` +
                       `👤 *Artist:* ${lyrics.artist}\n\n` +
                       `───────────────────\n\n` +
                       `${lyrics.lyrics}\n\n` +
                       `───────────────────\n` +
                       `> *© ZANTA-MD LYRICS*`;

        // සින්දුවේ Image එක සමඟ පද පේළි යැවීම
        await bot.sendMessage(from, {
            image: { url: lyrics.image },
            caption: lyricsMsg,
            contextInfo: {
                forwardingScore: 999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: '120363406265537739@newsletter',
                    serverMessageId: 100,
                    newsletterName: "𝒁𝑨𝑵𝑻𝑨-𝑴𝑫 𝑶𝑭𝑭𝑰𝑪𝑰𝑨𝑳"
                }
            }
        }, { quoted: mek });

        await bot.sendMessage(from, { react: { text: "✅", key: m.key } });

    } catch (e) {
        console.error("Lyrics Error:", e);
        reply("❌ දෝෂයක් සිදු විය: " + e.message);
    }
});
