const gis = require('g-i-s');
const { cmd } = require("../command");
const config = require("../config");

cmd({
    pattern: "jid",
    alias: ["myid", "userjid"],
    react: "🆔",
    desc: "Get user's JID or replied user's JID.",
    category: "main",
    filename: __filename,
}, async (zanta, mek, m, { from, reply, isGroup, sender, userSettings }) => { // <--- userSettings එකතු කළා
    try {
        const settings = userSettings || global.CURRENT_BOT_SETTINGS;
        const botName = settings.botName || config.DEFAULT_BOT_NAME || "ZANTA-MD";

        let targetJid = m.quoted ? m.quoted.sender : sender;

        let jidMsg = `╭━─━─━─━─━╮\n┃ 🆔 *USER JID INFO* ┃\n╰━─━─━─━─━╯\n\n`;
        jidMsg += `👤 *User:* @${targetJid.split('@')[0]}\n`;
        jidMsg += `🎫 *JID:* ${targetJid}\n\n`;

        if (isGroup) {
            jidMsg += `🏢 *Group JID:* ${from}\n\n`;
        }

        jidMsg += `> *© ${botName} ID FINDER*`;

        await zanta.sendMessage(from, { 
            text: jidMsg, 
            mentions: [targetJid] 
        }, { quoted: mek });

    } catch (err) {
        console.error(err);
        reply("❌ JID එක ලබා ගැනීමට නොහැකි විය.");
    }
});

cmd({
    pattern: "speed",
    alias: ["system", "ms"],
    react: "⚡",
    desc: "Check bot's response speed.",
    category: "main",
    filename: __filename,
}, async (zanta, mek, m, { from, reply, userSettings }) => { // <--- userSettings එකතු කළා
    try {
        const settings = userSettings || global.CURRENT_BOT_SETTINGS;
        const botName = settings.botName || config.DEFAULT_BOT_NAME || "ZANTA-MD";

        const startTime = Date.now();

        const pinger = await zanta.sendMessage(from, { text: "🚀 *Checking Speed...*" }, { quoted: mek });

        const endTime = Date.now();
        const ping = endTime - startTime;

        await zanta.sendMessage(from, { 
            text: `⚡ *${botName} SPEED REPORT*\n\n🚄 *Response Time:* ${ping}ms\n📡 *Status:* Online\n\n> *© ${botName}*`, 
            edit: pinger.key 
        });

    } catch (err) {
        console.error(err);
        reply("❌ වේගය පරීක්ෂා කිරීමේදී දෝෂයක් විය.");
    }
});

cmd({
    pattern: "img",
    alias: ["image", "gimg"],
    react: "🖼️",
    desc: "Search and download images directly from Google using GIS.",
    category: "download",
    filename: __filename,
}, async (zanta, mek, m, { from, reply, q, userSettings }) => { // <--- userSettings එකතු කළා
    try {
        if (!q) return reply("❤️ *කරුණාකර පින්තූරයේ නම ලබා දෙන්න. (Ex: .img car)*");

        const settings = userSettings || global.CURRENT_BOT_SETTINGS;
        const botName = settings.botName || config.DEFAULT_BOT_NAME || "ZANTA-MD";

        await reply(`🔍 *"${q}" පින්තූර සොයමින් පවතී...*`);

        gis(q, async (error, results) => {
            if (error) {
                console.error(error);
                return reply("❌ *පින්තූර සෙවීමේදී දෝෂයක් සිදු විය.*");
            }

            if (!results || results.length === 0) {
                return reply("❌ *පින්තූර සොයාගත නොහැකි විය.*");
            }

            const imageUrl = results[0].url;

            await zanta.sendMessage(from, {
                image: { url: imageUrl },
                caption: `*🖼️ IMAGE DOWNLOADER*\n\n🔍 *Query:* ${q}\n🚀 *Bot:* ${botName}\n\n> *© Powered by ${botName}*`,
            }, { quoted: mek });
        });

    } catch (e) {
        console.error("GIS Error:", e);
        reply(`❌ *Error:* ${e.message}`);
    }
});
