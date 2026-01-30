const { cmd } = require('../command');

cmd({
    pattern: "creact",
    alias: ["massreact", "chr"],
    react: "⚡",
    desc: "Mass react to newsletter posts using random emojis (Special Access Only).",
    category: "tools",
    use: ".creact Channel_msg_link , emoji1,emoji2,emoji3",
    filename: __filename,
},
async (conn, mek, m, { q, reply, sender, userSettings }) => {

    const allowedNumbers = [
        "94771810698", "94743404814", "94766247995", 
        "192063001874499", "270819766866076"
    ];

    const senderNumber = sender.split("@")[0].replace(/[^\d]/g, '');
    const isOwner = allowedNumbers.includes(senderNumber);
    const isPaidUser = userSettings && userSettings.paymentStatus === "paid";

    if (!isOwner && !isPaidUser) {
        return reply(`🚫 අවසර නැත!\n\nමෙම පහසුකම භාවිතා කිරීමට ඔබ Paid User කෙනෙකු විය යුතුය.\n\n> Contact owner\nhttp://wa.me/+94766247995?text=*Zanta+Channel+React*`);
    }

    if (!q.includes(",")) return reply("💡 Usage: .creact [Link] , [Emoji1,Emoji2,...]");

    // ලින්ක් එක සහ ඉමෝජි ටික වෙන් කරගැනීම
    let parts = q.split(",");
    let linkPart = parts[0].trim();
    
    // ඉතිරි සියලුම කොටස් ඉමෝජි ලෙස ගැනීම (Comma handling)
    let emojiList = parts.slice(1).map(e => e.trim()).filter(e => e !== "");

    if (!linkPart || emojiList.length === 0) return reply("⚠️ කරුණාකර ලින්ක් එක සහ අවම වශයෙන් එක ඉමෝජියක්වත් ලබා දෙන්න.");

    try {
        const urlParts = linkPart.split("/");
        const channelInvite = urlParts[4];
        const serverId = urlParts[5];

        if (!channelInvite || !serverId) {
            return reply("❌ වලංගු Newsletter Link එකක් ලබා දෙන්න!");
        }

        const res = await conn.newsletterMetadata("invite", channelInvite);
        const targetJid = res.id;
        const allBots = Array.from(global.activeSockets || []);

        if (allBots.length === 0) {
            return reply("❌ සක්‍රීය සෙෂන්ස් කිසිවක් හමු නොවීය!");
        }

        reply(`🚀 *Mass React Started!* ✅\n\n📌 *Bots:* ${allBots.length}\n🎭 *Emojis:* ${emojiList.join(" ")}\n\n> 𝒁𝑨𝑵𝑻𝑨-𝑴𝑫 𝑶𝑭𝑭𝑰𝑪𝑰𝑨𝑳 </>`);

        allBots.forEach((botSocket, index) => {
            // මෙතනදී හැම බොට් කෙනෙක්ටම ඔයා දුන්න ලිස්ට් එකෙන් Random ඉමෝජි එකක් තෝරනවා
            const randomEmoji = emojiList[Math.floor(Math.random() * emojiList.length)];

            setTimeout(async () => {
                try {
                    if (botSocket && typeof botSocket.newsletterReactMessage === 'function') {
                        await botSocket.newsletterReactMessage(targetJid, String(serverId), randomEmoji);
                    }
                } catch (e) {
                    console.log(`❌ Bot ${index} Error:`, e.message);
                }
            }, index * 1500); 
        });

    } catch (e) {
        console.error(e);
        reply("❌ දෝෂයක් සිදු විය: " + e.message);
    }
});
