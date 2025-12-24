const { cmd } = require("../command"); // මෙහි cmd පමණක් ප්‍රමාණවත්
const config = require("../config");

// 🎯 Reply හඳුනාගැනීම සඳහා ID එක සේව් කරන Map එක (index.js එකට export කරයි)
const lastHelpMessage = new Map();

cmd({
    pattern: "help",
    alias: ["bothelp", "info", "උදව්"],
    category: "main",
    react: "❓",
    desc: "බොට් සහාය මධ්‍යස්ථානය.",
    filename: __filename,
}, async (zanta, mek, m, { from, reply, args, pushname }) => {
    try {
        const botName = global.CURRENT_BOT_SETTINGS?.botName || config.DEFAULT_BOT_NAME;

        // --- 📂 1. අංකයක් Reply කළ විට ක්‍රියාත්මක වන කොටස (index.js මගින් args එවයි) ---
        const selection = args[0]; 

        if (selection === "1") {
            let devMsg = `*👨‍💻 Bot Developer Details*

👤 *නම:* Akash Kavindu
🛠️ *ව්‍යාපෘතිය:* ZANTA-MD (WhatsApp Bot)
🌍 *රට:* ශ්‍රී ලංකා
🔗 *GitHub:* github.com/Akashkavindu
🔗 *WhatsApp:* http://wa.me/+94743404814?text=*Hey__ZANTA

> *Created with ❤️ by Akash*`;
            return reply(devMsg);
        }

        if (selection === "2") {
            let featMsg = `*🚀 ZANTA-MD All Features*

🖼️ *Media:* Getdp, Save status, Unlock view once image...

🎶 *Download:* Song, YTmp4, FB, Tiktok, Apk


🎨 *AI:* AI Image Gen (Genimg), Remove image Bg

🛠️ *Tools:* ToURL, ToQR, Ping, Alive, To sticker


🎮 *Fun:* Guess Game, Tod Game, Funtext

⚙️ *Admin:* Group Settings, Bot DB, Settings

_සවිස්තරාත්මක ලැයිස්තුවට .menu ටයිප් කරන්න._`;
            return reply(featMsg);
        }

        if (selection === "3") {
            let contactMsg = `*📞 Contact Me*

ඔබට කිසියම් ගැටළුවක් ඇත්නම් පහත ලින්ක් හරහා අපව සම්බන්ධ කරගන්න:

🔗 *Official WhatsApp:* http://wa.me/+94743404814?text=*Hey__ZANTA

🔗 *GitHub Support:* github.com/Akashkavindu/ZANTA_MD

🔗 *WhatsApp:* http://wa.me/+94743404814?text=*Hey__ZANTA

_ස්තුතියි!_`;
            return reply(contactMsg);
        }

        // --- 📂 2. මුලින්ම .help ගැසූ විට එන Main Help Message එක ---
        let mainHelp = `*✨ ${botName} සහය මධ්‍යස්ථානය ✨*

👋 ආයුබෝවන් *${pushname}*! ඔබට අවශ්‍ය සහය ලබා ගැනීමට අදාළ අංකය Reply කරන්න.

---
1️⃣ *බොට් සංවර්ධක (Bot Developer)*
2️⃣ *සියලුම විශේෂාංග (All Features)*
3️⃣ *සම්බන්ධ වීමට (Contact Me)*
---

> *ZANTA-MD Support System*`;

        const helpImg = "https://github.com/Akashkavindu/ZANTA_MD/blob/main/images/alive-new.jpg?raw=true";

        const sentHelp = await zanta.sendMessage(from, { 
            image: { url: helpImg }, 
            caption: mainHelp 
        }, { quoted: mek });

        // මැසේජ් ID එක සේව් කිරීම (index.js එකට මෙය අවශ්‍ය වේ)
        lastHelpMessage.set(from, sentHelp.key.id);

    } catch (e) {
        console.log(e);
        reply("❌ දෝෂයකි: " + e.message);
    }
});

// index.js එකට Map එක ලබාදීම සඳහා මෙය අනිවාර්ය වේ
module.exports = { lastHelpMessage };
