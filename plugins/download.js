const { cmd } = require("../command");
const axios = require('axios');
const config = require('../config');

// 📦 APK DOWNLOADER
cmd({
    pattern: "apk",
    alias: ["app", "playstore"],
    react: "📦",
    category: "download",
    filename: __filename
}, async (zanta, mek, m, { from, reply, q, userSettings }) => {
    try {
        if (!q) return reply("❌ *ඇප් එකේ නම ලබා දෙන්න.*");

        const loading = await zanta.sendMessage(from, { text: `🔍 *"${q}" සොයමින් පවතී...*` }, { quoted: mek });
        let appData = null;

        // --- Method 1: BK9 API ---
        try {
            const res1 = await axios.get(`https://bk9.fun/download/apk?q=${encodeURIComponent(q)}`);
            if (res1.data?.status && res1.data.BK9) {
                const b = res1.data.BK9;
                appData = { name: b.name, icon: b.icon, size: b.size, package: b.id, dl: b.dllink };
            }
        } catch (e) { /* silent fail */ }

        // --- Method 2: Fallback ---
        if (!appData) {
            try {
                const res2 = await axios.get(`https://api.shinoa.xyz/api/apk/search?q=${encodeURIComponent(q)}`);
                if (res2.data?.result?.length > 0) {
                    const id = res2.data.result[0].id;
                    const dlRes = await axios.get(`https://api.shinoa.xyz/api/apk/download?id=${id}`);
                    const r = dlRes.data.result;
                    appData = { name: r.name, icon: r.icon, size: r.size, package: r.package, dl: r.download };
                }
            } catch (e) { /* silent fail */ }
        }

        if (!appData || !appData.dl) return await zanta.sendMessage(from, { text: "❌ *සොයාගත නොහැකි විය.*", edit: loading.key });

        // Size Limit Check
        const sizeStr = appData.size || "0 MB";
        if (sizeStr.includes('GB') || (sizeStr.includes('MB') && parseFloat(sizeStr) > 200)) {
            return await zanta.sendMessage(from, { text: `⏳ *ප්‍රමාණය වැඩි බැවින් (${sizeStr}) ලබා දිය නොහැක.*`, edit: loading.key });
        }

        const settings = userSettings || global.CURRENT_BOT_SETTINGS || {};
        const botName = settings.botName || config.DEFAULT_BOT_NAME || "ZANTA-MD";

        // Send Details
        await zanta.sendMessage(from, { 
            image: { url: appData.icon }, 
            caption: `📛 *Name:* ${appData.name}\n⚖️ *Size:* ${appData.size}\n\n> *© ${botName}*` 
        }, { quoted: mek });

        // Send APK (Direct Stream)
        await zanta.sendMessage(from, {
            document: { url: appData.dl },
            mimetype: "application/vnd.android.package-archive",
            fileName: `${appData.name}.apk`
        }, { quoted: mek });

        await zanta.sendMessage(from, { text: "✅ *Upload Completed!*", edit: loading.key });

    } catch (e) {
        reply(`❌ *Error:* ${e.message}`);
    }
});

// 🕺 TIKTOK DOWNLOADER
cmd({
    pattern: "tiktok",
    alias: ["ttdl", "tt"],
    react: "🕺",
    category: "download",
    filename: __filename
}, async (zanta, mek, m, { from, reply, q, userSettings }) => {
    try {
        if (!q || !q.includes("tiktok.com")) return reply("❌ *වලංගු TikTok Link එකක් ලබා දෙන්න.*");

        const loading = await zanta.sendMessage(from, { text: "🔄 *පිටපත් කරමින්...*" }, { quoted: mek });

        const response = await axios.get(`https://www.tikwm.com/api/?url=${q}`);
        const videoData = response.data?.data;

        if (!videoData) return await zanta.sendMessage(from, { text: "❌ *වීඩියෝව සොයාගත නොහැකි විය.*", edit: loading.key });

        const settings = userSettings || global.CURRENT_BOT_SETTINGS || {};
        const botName = settings.botName || config.DEFAULT_BOT_NAME || "ZANTA-MD";

        await zanta.sendMessage(from, {
            video: { url: videoData.play },
            mimetype: "video/mp4",
            caption: `👤 *Creator:* ${videoData.author.unique_id}\n📝 *Title:* ${videoData.title || 'TikTok'}\n\n> *© ${botName}*`
        }, { quoted: mek });

        await zanta.sendMessage(from, { text: "✅ *Done!*", edit: loading.key });

    } catch (e) {
        reply(`❌ *Error:* ${e.message}`);
    }
});
