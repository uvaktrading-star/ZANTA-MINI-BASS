const { cmd } = require("../command");
const axios = require("axios");

cmd({
    pattern: "gemini",
    alias: ["gpt", "chatgpt", "ai"],
    react: "🤖",
    desc: "Chat with OpenAI ChatGPT AI.",
    category: "tools",
    filename: __filename
}, async (bot, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("🤖 *Hello! I am ZANTA-MD AI. How can I help you today?*\n\nExample: .ai Write a short poem about Sri Lanka.");

        await bot.sendMessage(from, { react: { text: "🧠", key: m.key } });

        const API_URL = `https://apis.sandarux.sbs/api/ai/chatopenai?apikey=darknero&text=${encodeURIComponent(q)}`;
        const { data } = await axios.get(API_URL);

        // මෙතන තමයි වෙනස: 'data.answer' චෙක් කරන්න ඕනේ
        if (!data.status || !data.answer) {
            return reply("❌ AI සේවාව මේ වෙලාවේ කාර්යබහුලයි. පසුව උත්සාහ කරන්න.");
        }

        const aiResponse = data.answer; // 'result' වෙනුවට 'answer' ගන්න

        let finalMsg = `${aiResponse}\n\n> *© 𝑷𝒐𝒘𝒆𝒓𝒆𝒅 𝑩𝒚 𝒁𝑨𝑵𝑻𝑨-𝑴𝑫*`;

        await bot.sendMessage(from, {
            text: finalMsg,
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
        console.error("AI Error:", e);
        reply("❌ AI Error: " + e.message);
    }
});
