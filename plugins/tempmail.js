const { cmd } = require("../command");
const axios = require("axios");

cmd({
    pattern: "tempmail",
    alias: ["tmail", "mail"],
    react: "📧",
    desc: "Generate a temporary email address.",
    category: "tools",
    filename: __filename
}, async (bot, mek, m, { from, reply }) => {
    try {
        await bot.sendMessage(from, { react: { text: "⏳", key: m.key } });

        const API_URL = `https://apis.sandarux.sbs/api/tools/tempmail?apikey=darknero`;
        const { data } = await axios.get(API_URL);

        if (!data.status || !data.result) {
            return reply("❌ ඊමේල් ලිපිනයක් ජෙනරේට් කිරීමට නොහැකි විය. පසුව උත්සාහ කරන්න.");
        }

        let mailMsg = `📧 *ZANTA-MD TEMP MAIL* 📧\n\n` +
                      `📍 *Email:* ${data.result}\n\n` +
                      `> *Note:* Use this email for temporary registrations. Check your inbox using the specific tool if available.\n\n` +
                      `> *© ZANTA-MD TOOLS SERVICE*`;

        await bot.sendMessage(from, {
            text: mailMsg,
        }, { quoted: mek });

        await bot.sendMessage(from, { react: { text: "✅", key: m.key } });

    } catch (e) {
        console.error("TempMail Error:", e);
        reply("❌ දෝෂයක් සිදු විය: " + e.message);
    }
});
