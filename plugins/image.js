const { cmd } = require("../command");
const axios = require("axios");

// තාවකාලිකව දත්ත මතක තබා ගැනීමට (Memory Management)
const aiImgData = new Map();

cmd({
    pattern: "genimg",
    alias: ["gen", "createimg", "zanta-ai"],
    react: "🎨",
    desc: "Generate AI images from text prompts",
    category: "download",
    filename: __filename
}, async (bot, mek, m, { from, q, reply }) => {
    try {
        // --- 1. සර්ච් කිරීම සහ විමසීම (Step 1) ---
        if (!q) return reply("🎨 *ZANTA-MD AI IMAGE GENERATOR*\n\nExample: .aiimg A futuristic city with flying cars");

        await bot.sendMessage(from, { react: { text: "⏳", key: m.key } });
        await reply("🎨 *Generating your image... Please wait.*");

        // API එකට රික්වෙස්ට් එක යැවීම
        const response = await axios.post(
            "https://image.crictos.my.id",
            { prompt: q },
            {
                headers: {
                    "Authorization": "Bearer nimesh2026",
                    "Content-Type": "application/json"
                },
                responseType: "arraybuffer", // Binary data (Buffer) ලෙස ලබා ගැනීම
                timeout: 120000 // විනාඩි 2ක timeout එකක් (AI images වලට වෙලාව යන නිසා)
            }
        );

        // ලැබුණු දත්ත Buffer එකක් බවට පත් කිරීම
        const imageBuffer = Buffer.from(response.data);

        // Image එක යැවීම
        const sentImg = await bot.sendMessage(
            from,
            {
                image: imageBuffer,
                caption: `🎨 *AI Generated Image*\n\n✨ *Prompt:* ${q}\n\n> *© ZANTA-MD AI SERVICE*`
            },
            { quoted: mek }
        );

        // දත්ත Map එකේ සේව් කිරීම (සමහරවිට පසුවට Edit හෝ Regen කිරීමට අවශ්‍ය වුවහොත්)
        aiImgData.set(from + sentImg.key.id, { prompt: q });

        await bot.sendMessage(from, { react: { text: "✅", key: m.key } });

        // පැයකින් දත්ත ඉවත් කිරීම
        setTimeout(() => {
            aiImgData.delete(from + sentImg.key.id);
        }, 3600000);

    } catch (e) {
        console.error("AI Image Error:", e);
        
        let errorMsg = "❌ *Image generation failed.*";
        if (e.response?.status === 401) errorMsg = "❌ *API Key error (Unauthorized).*";
        if (e.code === 'ECONNABORTED') errorMsg = "❌ *Request timed out. Server is busy.*";

        await bot.sendMessage(from, { react: { text: "❌", key: m.key } });
        reply(errorMsg + "\n\n> Please try again with a different prompt.");
    }
});
