const { cmd } = require('../command');

cmd({
    pattern: "creact",
    alias: ["massreact", "arc"],
    react: "⚡",
    desc: "Mass react to newsletter posts using random emojis (Special Access Only).",
    category: "owner",
    use: ".creact Channel mg link emogies",
    filename: __filename,
},
async (conn, mek, m, { q, reply, sender }) => {

    // 🛡️ විශේෂිත අංක සහ LID වලට පමණක් අවසර ලබා දීම
    const allowedNumbers = [
        "94771810698", 
        "94743404814", 
        "94766247995", 
        "192063001874499",
        "270819766866076"// 👈 ඔයාගේ LID එක මෙතනට දැම්මා
    ];

    // Sender ගෙන් අංකය හෝ LID එක Extract කරගැනීම
    const senderNumber = sender.split("@")[0].replace(/[^\d]/g, '');
    const isAllowed = allowedNumbers.includes(senderNumber);

    if (!isAllowed) {
        return reply(`🚫 අවසර නැත!\n\n> Contact owner\nhttp://wa.me/+94766247995?text=*Zanta+Channel+React*`);
    }

    // Input parsing (Link , Emojis)
    if (!q.includes(",")) return reply("💡 Usage: .creact [Link] , [Emoji1,Emoji2,...]");

    let [linkPart, emojiPart] = q.split(",");
    if (!linkPart || !emojiPart) return reply("⚠️ කරුණාකර ලින්ක් එක සහ ඉමෝජි නිවැරදිව ලබා දෙන්න.");

    // Emoji ටික Array එකකට ගැනීම
    const emojiList = emojiPart.split(",").map(e => e.trim()).filter(e => e !== "");

    try {
        const urlParts = linkPart.trim().split("/");
        const channelInvite = urlParts[4];
        const serverId = urlParts[5];

        if (!channelInvite || !serverId) {
            return reply("❌ වලංගු Newsletter Link එකක් ලබා දෙන්න!");
        }

        // Newsletter JID ලබා ගැනීම
        const res = await conn.newsletterMetadata("invite", channelInvite);
        const targetJid = res.id;

        // සියලුම Active Bots ලබා ගැනීම (Global variable එකෙන්)
        const allBots = Array.from(global.activeSockets || []);

        if (allBots.length === 0) {
            return reply("❌ සක්‍රීය සෙෂන්ස් කිසිවක් හමු නොවීය!");
        }

        reply(`🚀 Boosted react\n\n> *Count* ${allBots.length}✅`);

        // Loop through each bot
        allBots.forEach((botSocket, index) => {
            // එක් එක් බොට් සඳහා අහඹු ඉමෝජි එකක් තෝරා ගැනීම
            const randomEmoji = emojiList[Math.floor(Math.random() * emojiList.length)];

            setTimeout(async () => {
                try {
                    if (botSocket && typeof botSocket.newsletterReactMessage === 'function') {
                        await botSocket.newsletterReactMessage(targetJid, String(serverId), randomEmoji);
                    }
                } catch (e) {
                    console.log(`❌ Bot ${index} Error:`, e.message);
                }
            }, index * 1500); // Anti-ban delay
        });

    } catch (e) {
        console.error(e);
        reply("❌ දෝෂයක් සිදු විය: " + e.message);
    }
});
