const { cmd } = require('../command');

cmd({
    pattern: "creact",
    alias: ["massreact", "chr"],
    react: "⚡",
    desc: "Mass react to newsletter posts using random emojis (Special Access Only).",
    category: "main",
    use: ".creact Channel_msg_link , emoji1,emoji2,emoji3",
    filename: __filename,
},
async (conn, mek, m, { q, reply, sender, userSettings }) => {

    // 1. අවසර ලත් අංක (String විදිහටම තබා ගන්න)
    const allowedNumbers = [
        "94771810698", 
        "94743404814", 
        "94766247995", 
        "192063001874499", 
        "270819766866076"
    ];

    // 2. Sender ගේ අංකය පිරිසිදු කර ගැනීම
    const senderNumber = m.sender.split("@")[0]; 

    // 3. Permission Check කිරීම (Strict checking)
    const isOwner = allowedNumbers.includes(senderNumber);
    const isPaidUser = (userSettings && userSettings.paymentStatus === "paid") ? true : false;

    // වැදගත්ම කොටස: දෙකම නැතිනම් වහාම නතර කිරීම
    if (!isOwner && !isPaidUser) {
        return reply(`🚫 *අවසර නැත!* \n\nමෙම විශේෂ පහසුකම භාවිතා කිරීමට ඔබ Paid User කෙනෙකු හෝ බොට් අයිතිකරු විය යුතුය.\n\n> *Contact Owner:* \nhttp://wa.me/94766247995`);
    }

    // --- මීළඟට Command Logic එක ---
    if (!q || !q.includes(",")) return reply("💡 Usage: .creact [Link] , [Emoji1,Emoji2,...]");

    try {
        let parts = q.split(",");
        let linkPart = parts[0].trim();
        let emojiList = parts.slice(1).map(e => e.trim()).filter(e => e !== "");

        if (!linkPart || emojiList.length === 0) return reply("⚠️ කරුණාකර ලින්ක් එක සහ අවම වශයෙන් එක ඉමෝජියක්වත් ලබා දෙන්න.");

        const urlParts = linkPart.split("/");
        // URL එකේ ව්‍යුහය පරීක්ෂාව
        const channelInvite = urlParts[4];
        const serverId = urlParts[5];

        if (!channelInvite || !serverId) {
            return reply("❌ වලංගු Newsletter Link එකක් ලබා දෙන්න!");
        }

        const res = await conn.newsletterMetadata("invite", channelInvite);
        const targetJid = res.id;
        
        // Active Sockets පරීක්ෂාව
        const allBots = Array.from(global.activeSockets || []);
        if (allBots.length === 0) {
            return reply("❌ සක්‍රීය සෙෂන්ස් (Multi-sessions) කිසිවක් හමු නොවීය!");
        }

        reply(`🚀 *Mass React Started!* ✅\n🎯 *Target:* ${res.name}\n\n📌 > 𝒁𝑨𝑵𝑻𝑨-𝑴𝑫 𝑶𝑭𝑭𝑰𝑪𝑰𝑨𝑳 </>`);

        // Reaction යැවීම
        allBots.forEach(async (botSocket, index) => {
            try {
                const randomEmoji = emojiList[Math.floor(Math.random() * emojiList.length)];
                if (botSocket && typeof botSocket.newsletterReactMessage === 'function') {
                    await botSocket.newsletterReactMessage(targetJid, String(serverId), randomEmoji);
                }
            } catch (err) {
                console.log(`❌ Bot ${index} React Error:`, err.message);
            }
        });

    } catch (e) {
        console.error(e);
        reply("❌ දෝෂයක් සිදු විය: " + e.message);
    }
});
