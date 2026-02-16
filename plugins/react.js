const { cmd } = require('../command');
const mongoose = require("mongoose");

// Signal Model එක (index.js එකේ ඇති එකට සමාන විය යුතුය)
const Signal = mongoose.models.Signal || mongoose.model("Signal", new mongoose.Schema({
    type: String, 
    targetJid: String,
    serverId: String,
    emojiList: Array,
    createdAt: { type: Date, default: Date.now, expires: 60 }
}));

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

    // අවසර ඇති අංක
    const allowedNumbers = [
        "94771810698", "94743404814", "94766247995", 
        "192063001874499", "270819766866076"
    ];

    const senderNumber = sender.split("@")[0].replace(/[^\d]/g, '');
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

        const urlParts = linkPart.split("/");
        const inviteCode = urlParts[4];
        const serverId = urlParts[urlParts.length - 1]; 

        if (!inviteCode || isNaN(serverId)) {
            return reply("❌ වලංගු Newsletter Message Link එකක් ලබා දෙන්න!");
        }

        // 1. Newsletter JID එක ලබා ගැනීම
        const metadata = await conn.newsletterMetadata("invite", inviteCode);
        const targetJid = metadata.id;

        await reply(`🚀 *Mass React Signal Sent!* ✅\n🎯 *Target:* ${metadata.name}\n📡 *Status:* Broadcasting to all instances...\n\n📌 > 𝒁𝑨𝑵𝑻𝑨-𝑴𝑫 𝑶𝑭𝑭𝑰𝑪𝑰𝑨𝑳 </>`);

        // 2. MongoDB එකට Signal එක ඇතුළත් කිරීම
        // index.js එකේ watcher එක මගින් සියලුම instances වලට පණිවිඩය යවයි.
        await Signal.create({
            type: "react",
            targetJid: targetJid,
            serverId: String(serverId),
            emojiList: emojiList
        });

    } catch (e) {
        console.error(e);
        reply("❌ දෝෂයක් සිදු විය: " + e.message);
    }
});
