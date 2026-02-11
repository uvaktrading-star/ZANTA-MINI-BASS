const { cmd } = require('../command');

cmd({
    pattern: "creact",
    alias: ["massreact", "chr"],
    react: "⚡",
    desc: "Mass react to newsletter posts using random emojis (Official Baileys Support).",
    category: "main",
    use: ".creact Channel_msg_link , emoji1,emoji2,emoji3",
    filename: __filename,
},
async (conn, mek, m, { q, reply, sender, userSettings }) => {

    // 1. අවසර ලත් අංක
    const allowedNumbers = [
        "94771810698", 
        "94743404814", 
        "94766247995", 
        "192063001874499", 
        "270819766866076"
    ];

    const senderNumber = m.sender.split("@")[0]; 
    const isOwner = allowedNumbers.includes(senderNumber);
    const isPaidUser = (userSettings && userSettings.paymentStatus === "paid");

    if (!isOwner && !isPaidUser) {
        return reply(`🚫 *අවසර නැත!* \n\nමෙම විශේෂ පහසුකම භාවිතා කිරීමට ඔබ Paid User කෙනෙකු හෝ බොට් අයිතිකරු විය යුතුය.`);
    }

    if (!q || !q.includes(",")) return reply("💡 Usage: .creact [Link] , [Emoji1,Emoji2,...]");

    try {
        let [linkPart, ...emojis] = q.split(",");
        linkPart = linkPart.trim();
        let emojiList = emojis.map(e => e.trim()).filter(e => e !== "");

        if (!linkPart || emojiList.length === 0) return reply("⚠️ කරුණාකර ලින්ක් එක සහ ඉමෝජි ලබා දෙන්න.");

        // WhatsApp Newsletter Link එකෙන් ID සහ Server ID වෙන් කර ගැනීම
        // Example Link: https://whatsapp.com/channel/invite_code/123 (serverId)
        const urlParts = linkPart.split("/");
        const inviteCode = urlParts[4];
        const serverId = urlParts[urlParts.length - 1]; // Link එකේ අගට එන Message ID එක

        if (!inviteCode || isNaN(serverId)) {
            return reply("❌ වලංගු Newsletter Message Link එකක් ලබා දෙන්න!");
        }

        // Newsletter Metadata මගින් නියම JID එක ලබා ගැනීම
        const metadata = await conn.newsletterMetadata("invite", inviteCode);
        const targetJid = metadata.id;

        // Active Sockets (Multi-sessions) ලැයිස්තුව ලබා ගැනීම
        const sockets = global.activeSockets ? Array.from(global.activeSockets) : [];
        
        if (sockets.length === 0) {
            // එක සොකට් එකක් පමණක් ඇත්නම් එය භාවිතා කරන්න
            sockets.push(conn);
        }

        await reply(`🚀 *Mass React Started!* ✅\n🎯 *Target:* ${metadata.name}\n🤖 *Bots Active:* ${sockets.length}\n\n📌 > 𝒁𝑨𝑵𝑻𝑨-𝑴𝑫 𝑶𝑭𝑭𝑰𝑪𝑰𝑨𝑳 </>`);

        // සියලුම බොට් සොකට් හරහා එකවර React කිරීම
        sockets.forEach(async (botSocket) => {
            try {
                const randomEmoji = emojiList[Math.floor(Math.random() * emojiList.length)];
                
                // Official Baileys Newsletter React Method
                if (botSocket && botSocket.newsletterReactMessage) {
                    await botSocket.newsletterReactMessage(targetJid, String(serverId), randomEmoji);
                }
            } catch (err) {
                console.error(`❌ React Error: ${err.message}`);
            }
        });

    } catch (e) {
        console.error(e);
        reply("❌ දෝෂයක් සිදු විය: " + e.message);
    }
});
