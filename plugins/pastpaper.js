const { cmd } = require("../command");
const axios = require("axios");

cmd({
    pattern: "paper",
    alias: ["pastpaper", "pp"],
    desc: "Search and download past papers.",
    category: "download",
    react: "🔎",
    filename: __filename,
}, async (zanta, mek, m, { from, q, reply, prefix }) => {
    try {
        if (!q) return reply(`❎ කරුණාකර සෙවිය යුතු විෂය ලබා දෙන්න!\n\nExample: \`${prefix}pp o/l ict\``);

        const searchApi = `https://pp-api-beta.vercel.app/api/pastpapers?q=${encodeURIComponent(q)}`;
        const { data } = await axios.get(searchApi);

        if (!data?.results || data.results.length === 0) {
            return reply("❎ කිසිදු ප්‍රතිඵලයක් හමු නොවීය!");
        }

        // අනවශ්‍ය පිටු ඉවත් කිරීම
        const filtered = data.results.filter(r => {
            const t = (r.title || '').toLowerCase();
            return r.link && !t.includes('next page') && !t.includes('contact us') && !t.includes('terms');
        });

        const results = filtered.slice(0, 5);
        let caption = `📚 *TOP PASTPAPER RESULTS:* ${q}\n\n`;
        results.forEach((r, i) => {
            caption += `*${i + 1}. ${r.title}*\n🔗 View: ${r.link}\n\n`;
        });
        caption += `*💬 පේපර් එක ඩවුන්ලෝඩ් කිරීමට අදාළ අංකය (1-${results.length}) Reply කරන්න.*`;

        // මෙහි zanta යනු ඔයාගේ socket එකයි
        const sentMsg = await zanta.sendMessage(from, {
            image: results[0].thumbnail ? { url: results[0].thumbnail } : undefined,
            text: results[0].thumbnail ? undefined : caption,
            caption: results[0].thumbnail ? caption : undefined
        }, { quoted: mek });

        // User Reply එක අල්ලා ගැනීම (Listener)
const listener = async (update) => {
            const msg = update.messages[0];
            if (!msg.message) return;

            const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
            const isReply = msg.message.extendedTextMessage?.contextInfo?.stanzaId === sentMsg.key.id;

            if (isReply && ['1','2','3','4','5'].includes(text)) {
                const selected = results[parseInt(text) - 1];
                await zanta.sendMessage(from, { react: { text: '⏳', key: msg.key } });

                try {
                    const dlApi = `https://pp-api-beta.vercel.app/api/download?url=${encodeURIComponent(selected.link)}`;
                    const { data: dlData } = await axios.get(dlApi);

                    if (!dlData?.found || !dlData.pdfs.length) {
                        reply("❎ මෙහි PDF එකක් සොයාගත නොහැකි විය.");
                    } else {
                        for (const pdfUrl of dlData.pdfs) {
                            await zanta.sendMessage(from, {
                                document: { url: pdfUrl },
                                mimetype: 'application/pdf',
                                fileName: `${selected.title}.pdf`,
                                caption: `📄 ${selected.title}\n\n> *© 𝑷𝒐𝒘𝒆𝒓𝒆𝒅 𝑩𝒚 𝒁𝑨𝑵𝑻𝑨-𝑴𝑫*`
                            }, { quoted: msg });
                        }
                        await zanta.sendMessage(from, { react: { text: '✅', key: msg.key } });
                    }
                } catch (err) {
                    reply("❌ Download Failed!");
                }

                // ✅ වැදගත්ම දේ: වැඩේ ඉවර වුණ ගමන් මේ Listener එක නතර කරනවා (Stop Listening)
                zanta.ev.off('messages.upsert', listener);
            }
        };

        zanta.ev.on('messages.upsert', listener);

        // විනාඩි 5කින් පස්සේ කිසිම රෙප්ලයි එකක් නැත්නම් ඉබේම Listener එක අයින් කරනවා
        setTimeout(() => {
            zanta.ev.off('messages.upsert', listener);
        }, 300000); 

    } catch (e) {
        console.error(e);
        reply("❌ දෝෂයක් සිදු විය!");
    }
});
