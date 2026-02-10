const { cmd } = require("../command");
const axios = require("axios");

// තාවකාලිකව දත්ත මතක තබා ගැනීමට (RAM Cleanup Optimized)
const paperData = new Map();

cmd({
    pattern: "paper",
    alias: ["pastpaper", "pp", "exam"],
    react: "🔎",
    desc: "Search and download past papers from Paperhub.",
    category: "download",
    filename: __filename
}, async (bot, mek, m, { from, q, reply, prefix }) => {
    try {
        // --- 1. පේපර් එක ඩවුන්ලෝඩ් කිරීම (Reply Logic) ---
        if (m.quoted && paperData.has(from + m.quoted.stanzaId)) {
            const results = paperData.get(from + m.quoted.stanzaId);
            const index = parseInt(q) - 1;
            const selected = results[index];

            if (!selected) return reply("⚠️ වැරදි අංකයකි. ලැයිස්තුවේ ඇති අංකයක් ලබා දෙන්න.");
            if (!selected.download) return reply("❌ සමාවෙන්න, මේ පේපර් එකට සෘජු ඩවුන්ලෝඩ් ලින්ක් එකක් හමු නොවීය.");

            await bot.sendMessage(from, { react: { text: '⏳', key: m.key } });

            // [DIRECT STREAM METHOD]
            // PDF එක RAM එකට නොගෙන URL එක හරහා කෙලින්ම WhatsApp වෙත යොමු කරයි.
            await bot.sendMessage(from, {
                document: { url: selected.download },
                mimetype: 'application/pdf',
                fileName: `${selected.title}.pdf`,
                caption: `📄 *${selected.title}*\n\n> *© ZANTA-MD PAPER SERVICE*`
            }, { quoted: m });

            await bot.sendMessage(from, { react: { text: '✅', key: m.key } });
            return;
        }

        // --- 2. පේපර් සර්ච් කිරීම ---
        if (!q) return reply(`📚 *ZANTA PAPER SEARCH*\n\nExample: \`${prefix}paper combined maths\``);

        const API_URL = `https://apis.sandarux.sbs/api/download/paperhub?apikey=darknero&q=${encodeURIComponent(q)}`;
        const { data } = await axios.get(API_URL);

        if (!data.status || !data.results || data.results.length === 0) {
            return reply("❎ කිසිදු ප්‍රතිඵලයක් හමු නොවීය!");
        }

        // පළමු ප්‍රතිඵල 10 පමණක් ගැනීම
        const results = data.results.slice(0, 10);
        let msg = `📚 *ZANTA-MD PAPER HUB* 📚\n\n🔍 Query: *${q}*\n\n`;
        
        results.forEach((res, index) => {
            msg += `${index + 1}️⃣ *${res.title}*\n`;
        });
        
        msg += `\n> *පේපර් එක ලබා ගැනීමට අදාළ අංකය Reply කරන්න.* \n\n*© ZANTA-MD*`;

        const sentMsg = await bot.sendMessage(from, {
            image: { url: results[0].image || "https://paperhub.lk/wp-content/uploads/2022/04/paperhub_logo.png" },
            caption: msg
        }, { quoted: mek });

        // සර්ච් රිසල්ට් එක Map එකේ සේව් කිරීම
        paperData.set(from + sentMsg.key.id, results);

        // පැයකින් මතකයෙන් ඉවත් කිරීම
        setTimeout(() => {
            paperData.delete(from + sentMsg.key.id);
        }, 3600000);

    } catch (e) {
        console.error("Paperhub Error:", e);
        reply("❌ දෝෂයක් සිදු විය: " + e.message);
    }
});
