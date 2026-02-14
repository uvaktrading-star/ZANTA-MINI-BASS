const { cmd } = require('../command');
const mongoose = require("mongoose");

// Signal Schema එක මෙතැනදීත් අවශ්‍ය වේ (index.js හි ඇති එකම විය යුතුය)
const SignalSchema = new mongoose.Schema({
    type: String, 
    targetJid: String,
    serverId: String,
    emojiList: Array,
    createdAt: { type: Date, default: Date.now, expires: 60 }
});
const Signal = mongoose.models.Signal || mongoose.model("Signal", SignalSchema);

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

        const urlParts = linkPart.split("/");
        const inviteCode = urlParts[4];
        const serverId = urlParts[urlParts.length - 1]; 

        if (!inviteCode || isNaN(serverId)) {
            return reply("❌ වලංගු Newsletter Message Link එකක් ලබා දෙන්න!");
        }

        // Newsletter JID එක ලබා ගැනීම
        const metadata = await conn.newsletterMetadata("invite", inviteCode);
        const targetJid = metadata.id;

        await reply(`🚀 *Multi-Instance Mass React Started!* ✅\n🎯 *Target:* ${metadata.name}\n📡 *Status:* Broadcasting to all servers...\n\n📌 > 𝒁𝑨𝑵𝑻𝑨-𝑴𝑫 𝑶𝑭𝑭𝑰𝑪𝑰𝑨𝑳 </>`);

        // --- නව SIGNAL LOGIC එක ---
        // මෙහිදී sockets.forEach වෙනුවට MongoDB එකට signal එකක් යවයි.
        // එවිට සියලුම App Instances වල ඇති index.js watcher එක මගින් මෙය ක්‍රියාත්මක කරයි.
        
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
