const gis = require('g-i-s');
const { cmd } = require("../command");
const { translate } = require('@vitalets/google-translate-api');
const config = require("../config");

// 1. JID Finder
cmd({
    pattern: "jid",
    alias: ["myid", "userjid"],
    react: "🆔",
    category: "main",
    filename: __filename,
}, async (zanta, mek, m, { from, sender, isGroup, userSettings }) => {
    try {
        const settings = userSettings || global.CURRENT_BOT_SETTINGS || {};
        const botName = settings.botName || config.DEFAULT_BOT_NAME || "ZANTA-MD";
        const targetJid = m.quoted ? m.quoted.sender : sender;

        let jidMsg = `🆔 *USER JID INFO*\n\n👤 *User:* @${targetJid.split('@')[0]}\n🎫 *JID:* ${targetJid}\n`;
        if (isGroup) jidMsg += `🏢 *Group JID:* ${from}\n`;
        jidMsg += `\n> *© ${botName}*`;

        await zanta.sendMessage(from, { text: jidMsg, mentions: [targetJid] }, { quoted: mek });
    } catch (err) {
        // Log ඉවත් කර සරලව reply කළා
    }
});

// 2. Speed Test
cmd({
    pattern: "speed",
    alias: ["system", "ms"],
    react: "⚡",
    category: "main",
    filename: __filename,
}, async (zanta, mek, m, { from, userSettings }) => {
    try {
        const settings = userSettings || global.CURRENT_BOT_SETTINGS || {};
        const botName = settings.botName || config.DEFAULT_BOT_NAME || "ZANTA-MD";
        const startTime = Date.now();

        const pinger = await zanta.sendMessage(from, { text: "🚀 *Checking...*" }, { quoted: mek });
        const ping = Date.now() - startTime;

        await zanta.sendMessage(from, { 
            text: `⚡ *${botName} SPEED*\n\n🚄 *Latency:* ${ping}ms\n📡 *Status:* Online\n\n> *© ${botName}*`, 
            edit: pinger.key 
        });
    } catch (err) {}
});

// 3. Image Downloader (GIS)
cmd({
    pattern: "img",
    alias: ["image", "gimg"],
    react: "🖼️",
    category: "download",
    filename: __filename,
}, async (zanta, mek, m, { from, reply, q, userSettings }) => {
    try {
        if (!q) return reply("❤️ *කරුණාකර නමක් ලබා දෙන්න.*");
        const settings = userSettings || global.CURRENT_BOT_SETTINGS || {};
        const botName = settings.botName || config.DEFAULT_BOT_NAME || "ZANTA-MD";

        gis(q, async (error, results) => {
            if (error || !results || results.length === 0) return reply("❌ *පින්තූර සොයාගත නොහැකි විය.*");

            // RAM එක ඉතිරි කරගන්න කෙලින්ම URL එකෙන් Image එක යැවීම
            await zanta.sendMessage(from, {
                image: { url: results[0].url },
                caption: `*🖼️ IMAGE DOWNLOADER*\n🔍 *Query:* ${q}\n\n> *© ${botName}*`,
            }, { quoted: mek });
        });
    } catch (e) {}
});

// 4. Translator
cmd({
    pattern: "tr",
    alias: ["translate"],
    react: "🌍",
    category: "convert",
    filename: __filename,
}, async (zanta, mek, m, { from, reply, q, userSettings }) => {
    try {
        const settings = userSettings || global.CURRENT_BOT_SETTINGS || {};
        const botName = settings.botName || config.DEFAULT_BOT_NAME || "ZANTA-MD";
        const text = m.quoted ? m.quoted.body : q;

        if (!text) return reply("❤️ *පණිවිඩයකට Reply කරන්න හෝ වචනයක් ලබා දෙන්න.*");

        const loading = await zanta.sendMessage(from, { text: "🔠 *Translating...*" }, { quoted: mek });
        const result = await translate(text, { to: 'si' });

        await zanta.sendMessage(from, { 
            text: `${result.text}\n\n> *© ${botName}*`, 
            edit: loading.key 
        });
    } catch (err) {
        reply("❌ *පරිවර්තනය අසාර්ථක විය.*");
    }
});
