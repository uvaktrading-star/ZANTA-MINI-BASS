const gis = require('g-i-s');
const { cmd } = require("../command");

cmd({
    pattern: "jid",
    alias: ["myid", "userjid"],
    react: "🆔",
    desc: "Get user's JID or replied user's JID.",
    category: "main",
    filename: __filename,
}, async (zanta, mek, m, { from, reply, isGroup, sender }) => {
    try {
        // Reply karapu message ekak thiyanawanam eyage JID eka gannawa
        // Nathnam message eka ewapu kenage JID eka gannawa
        let targetJid = m.quoted ? m.quoted.sender : sender;

        let jidMsg = `╭━─━─━─━─━╮\n┃ 🆔 *USER JID INFO* ┃\n╰━─━─━─━─━╯\n\n`;
        jidMsg += `👤 *User:* @${targetJid.split('@')[0]}\n`;
        jidMsg += `🎫 *JID:* ${targetJid}\n\n`;

        if (isGroup) {
            jidMsg += `🏢 *Group JID:* ${from}\n\n`;
        }

        jidMsg += `> *© ZANTA-MD ID FINDER*`;

        // Mention ekak ekka message eka yawamu
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
}, async (zanta, mek, m, { from, reply }) => {
    try {
        const startTime = Date.now(); // මැසේජ් එක ලැබුණු වෙලාව

        // මුලින්ම පුංචි මැසේජ් එකක් යවනවා
        const pinger = await zanta.sendMessage(from, { text: "🚀 *Checking Speed...*" }, { quoted: mek });

        const endTime = Date.now(); // රිප්ලයි එක යැවූ වෙලාව
        const ping = endTime - startTime; // කාලය අතර වෙනස

        const botName = global.CURRENT_BOT_SETTINGS?.botName || "ZANTA-MD";

        // රිප්ලයි එක Edit කරලා Speed එක පෙන්වනවා
        await zanta.sendMessage(from, { 
            text: `⚡ *${botName} SPEED REPORT*\n\n🚄 *Response Time:* ${ping}ms\n📡 *Status:* Online\n\n> *© ZANTA-MD*`, 
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
}, async (zanta, mek, m, { from, reply, q }) => {
    try {
        if (!q) return reply("❤️ *කරුණාකර පින්තූරයේ නම ලබා දෙන්න. (Ex: .img car)*");

        await reply(`🔍 *"${q}" පින්තූර සොයමින් පවතී...*`);

        // g-i-s පාවිච්චි කරලා Google පින්තූර සෙවීම
        gis(q, async (error, results) => {
            if (error) {
                console.error(error);
                return reply("❌ *පින්තූර සෙවීමේදී දෝෂයක් සිදු විය.*");
            }

            if (!results || results.length === 0) {
                return reply("❌ *පින්තූර සොයාගත නොහැකි විය.*");
            }

            // ලැබෙන පින්තූර වලින් පළමු එක තෝරා ගැනීම
            const imageUrl = results[0].url;
            const botName = global.CURRENT_BOT_SETTINGS?.botName || "ZANTA-MD";

            await zanta.sendMessage(from, {
                image: { url: imageUrl },
                caption: `*🖼️ IMAGE DOWNLOADER*\n\n🔍 *Query:* ${q}\n🚀 *Bot:* ${botName}\n\n> *© Powered by ZANTA-MD*`,
            }, { quoted: mek });
        });

    } catch (e) {
        console.error("GIS Error:", e);
        reply(`❌ *Error:* ${e.message}`);
    }
});
