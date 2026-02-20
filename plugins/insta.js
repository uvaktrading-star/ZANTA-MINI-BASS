const { cmd } = require("../command");
const axios = require("axios");
const config = require("../config");

cmd({
    pattern: "insta",
    alias: ["ig", "instagram", "igdl"],
    react: "📸",
    desc: "Download Instagram Media with selection menu",
    category: "download",
    filename: __filename,
}, async (bot, mek, m, { from, q, reply, prefix, senderNumber, sender }) => {
    try {
        if (!q) return reply("📸 *ZANTA-MD INSTAGRAM DL*\n\nExample: .insta https://www.instagram.com/reels/xxxx/");
        if (!q.includes("instagram.com")) return reply("❌ Please provide valid link.");

        // API Request ekata reaction ekak dāmu
        await bot.sendMessage(from, { react: { text: "🔍", key: mek.key } });

        // Oyaage Vercel API eka paviachchi kirima
        const apiUrl = `https://instagram-green-ten.vercel.app/api/insta?url=${encodeURIComponent(q)}`;
        const response = await axios.get(apiUrl);

        if (response.data.status) {
            const result = response.data;
            
            // Thumbnail eka saha wisthara
            let msg = `✨ *INSTA DOWNLOADER* ✨\n\n` +
                      `📝 *Type:* Instagram Media\n` +
                      `🔗 *Link:* ${q.split('?')[0]}\n\n` +
                      `*Reply with a number:* \n\n` +
                      `1️⃣ *Download Media* (Video/Image)\n\n` +
                      `> *© Powered by ZANTA-MD*`;

            const sentMsg = await bot.sendMessage(from, { 
                image: { url: result.thumbnail }, 
                caption: msg 
            }, { quoted: mek });

            // --- Reply Listener Logic ---
            const listener = async (update) => {
                const msgUpdate = update.messages[0];
                if (!msgUpdate.message) return;

                const body = msgUpdate.message.conversation || 
                             msgUpdate.message.extendedTextMessage?.text;

                const isReplyToBot = msgUpdate.message.extendedTextMessage?.contextInfo?.stanzaId === sentMsg.key.id;

                if (isReplyToBot && body === '1') {
                    await bot.sendMessage(from, { react: { text: '📥', key: msgUpdate.key } });

                    try {
                        const mediaUrl = result.downloadUrl;
                        
                        // Media eka Video ekakda Image ekakda kiyala balala yawamu
                        if (mediaUrl.includes(".mp4") || mediaUrl.includes("video")) {
                            await bot.sendMessage(from, { 
                                video: { url: mediaUrl }, 
                                caption: `✅ *Downloaded by ZANTA-MD*`,
                                mentions: [sender]
                            }, { quoted: msgUpdate });
                        } else {
                            await bot.sendMessage(from, { 
                                image: { url: mediaUrl }, 
                                caption: `✅ *Downloaded by ZANTA-MD*`,
                                mentions: [sender]
                            }, { quoted: msgUpdate });
                        }

                        await bot.sendMessage(from, { react: { text: '✅', key: msgUpdate.key } });
                    } catch (err) {
                        reply("❌ Error while sending media.");
                    }

                    // Wede iwara unama listener eka off karamu
                    bot.ev.off('messages.upsert', listener);
                }
            };

            bot.ev.on('messages.upsert', listener);

            // Vinadi 5kin listener eka iwara karamu
            setTimeout(() => {
                bot.ev.off('messages.upsert', listener);
            }, 300000);

        } else {
            return reply("❌ Video not found.");
        }

    } catch (e) {
        console.log("INSTA ERROR:", e);
        reply("❌ *Error:* " + (e.response?.data?.message || e.message));
    }
});
