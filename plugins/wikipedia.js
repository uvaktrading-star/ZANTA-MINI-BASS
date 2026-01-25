const { cmd } = require("../command");
const axios = require("axios");
const config = require("../config");

const CHANNEL_JID = "120363233854483997@newsletter"; 
const DEFAULT_WIKI_IMAGE = "https://cdn.jsdelivr.net/gh/Akashkavindu/ZANTA_MD@main/images/zanta-md.png"; 

cmd({
    pattern: "wiki",
    alias: ["wikipedia", "search"],
    desc: "Search information from Wikipedia with an image.",
    category: "tools",
    react: "🌐",
    filename: __filename,
}, async (zanta, mek, m, { from, reply, q, prefix, userSettings }) => {
    try {
        if (!q) return reply(`⚠️ කරුණාකර සෙවිය යුතු මාතෘකාව ලබා දෙන්න.\n\n*E.g:* \`${prefix}wiki OpenAI\``);

        const loading = await zanta.sendMessage(from, { text: `🔍 *"${q}" ගැන සොයමින් පවතී...*` }, { quoted: mek });

        const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(q)}`;

        // Wikipedia 403 error එක මගහරවා ගැනීමට Header එක එකතු කර ඇත
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'ZantaMD/1.0 (https://github.com/Akashkavindu/ZANTA_MD)'
            }
        });

        const data = response.data;

        if (data.type === 'disambiguation' || !data.extract) {
            return await zanta.sendMessage(from, { text: "❌ කිසිදු තොරතුරක් හමු නොවීය. කරුණාකර නිවැරදි වචනයක් ලබා දෙන්න.", edit: loading.key });
        }

        const settings = userSettings || global.CURRENT_BOT_SETTINGS || {};
        const botName = settings.botName || config.DEFAULT_BOT_NAME || "𝒁𝑨𝑵𝑻𝑨-𝑴𝑫";

        const contextInfo = {
            forwardingScore: 999,
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
                newsletterJid: CHANNEL_JID,
                serverMessageId: 100,
                newsletterName: "𝒁𝑨𝑵𝑻𝑨-𝑴𝑫 𝑶𝑭𝑭𝑰𝑪𝑰𝑨𝑳 </>"
            }
        };

        let wikiMsg = `🌐 *𝑾𝑰𝑲𝑰𝑷𝑬𝑫𝑰𝑨 𝑺𝑬𝑨𝑹𝑪𝑯 𝑹𝑬𝑺𝑼𝑳𝑻𝑺* 🌐\n\n`;
        wikiMsg += `✨ *Title:* ${data.title}\n`;
        wikiMsg += `📝 *Description:* ${data.description || 'No description available'}\n\n`;
        wikiMsg += `📖 *Extract:* ${data.extract}\n\n`;
        wikiMsg += `🔗 *Read More:* ${data.content_urls.mobile.page}\n\n`;
        wikiMsg += `> *© 𝑷𝒐𝒘𝒆𝒓𝒆𝒅 𝑩𝒚 ${botName}*`;

        const imageUrl = (data.thumbnail && data.thumbnail.source) ? data.thumbnail.source : DEFAULT_WIKI_IMAGE;

        await zanta.sendMessage(from, {
            image: { url: imageUrl },
            caption: wikiMsg,
            contextInfo: contextInfo
        }, { quoted: mek });

        await zanta.sendMessage(from, { text: "✅ *Search Completed!*", edit: loading.key });

    } catch (e) {
        console.error(e);
        // Wikipedia එකේ සර්ච් කරන වචනය නැති වුණොත් එන Error එක හැඩල් කිරීම
        await zanta.sendMessage(from, { text: "❌ තොරතුරු ලබාගැනීමේදී දෝෂයක් සිදු විය. කරුණාකර නිවැරදි ඉංග්‍රීසි වචනයක් පාවිච්චි කරන්න." });
    }
});
