const { cmd } = require("../command");
const getFbVideoInfo = require("@xaviabot/fb-downloader");

cmd({
    pattern: "fb",
    alias: ["facebook"],
    react: "📥",
    desc: "Download Facebook Videos.",
    category: "download",
    filename: __filename,
}, async (zanta, mek, m, { from, reply, q }) => {
    try {
        if (!q) return reply("❤️ *කරුණාකර Facebook වීඩියෝ ලින්ක් එකක් ලබා දෙන්න.*");

        const fbRegex = /(https?:\/\/)?(www\.)?(facebook|fb)\.com\/.+/;
        if (!fbRegex.test(q)) return reply("☹️ *ලින්ක් එක වැරදියි.*");

        const currentBotName = global.CURRENT_BOT_SETTINGS.botName;
        const loadingDesc = `╭━─━─━─━─━─━──━╮\n┃ *${currentBotName} FB Downloader*\n╰━─━─━─━─━─━──━╯\n\n⏳ *Waiting for download...*`;

        // 1. මුලින්ම Logo එක සහ "Downloading" Caption එක සහිත පණිවිඩය යවයි
        const sentMsg = await zanta.sendMessage(from, {
            image: { url: "https://github.com/Akashkavindu/ZANTA_MD/blob/main/images/fb.jpg?raw=true" },
            caption: loadingDesc,
        }, { quoted: mek });

        const result = await getFbVideoInfo(q);

        if (!result || (!result.sd && !result.hd)) {
            // අසාර්ථක වුවහොත් පණිවිඩය Edit කරයි
            return await zanta.sendMessage(from, { 
                text: "☹️ *Failed to download video. Please check the link.*", 
                edit: sentMsg.key 
            });
        }

        const bestUrl = result.hd || result.sd;
        const quality = result.hd ? "HD" : "SD";

        // 2. බාගත කිරීම අවසන් වූ පසු එම Image එකේම Caption එක Edit කිරීම
        const successDesc = `╭━─━─━─━─━─━──━╮\n┃ *${currentBotName} FB Downloader*\n╰━─━─━─━─━─━──━╯\n\n✅ *Status:* Download Completed!\n👻 *Quality:* ${quality}`;

        await zanta.sendMessage(from, { 
            text: successDesc, 
            edit: sentMsg.key 
        });

        // 3. වීඩියෝව යැවීම
        await zanta.sendMessage(from, {
            video: { url: bestUrl },
            caption: `*📥 Quality: ${quality}*\n\n> *© ${currentBotName}*`,
        }, { quoted: mek });

    } catch (e) {
        console.error(e);
        reply(`❌ *Error:* ${e.message}`);
    }
});
