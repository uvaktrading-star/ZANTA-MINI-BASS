const { cmd } = require('../command');
const mongoose = require("mongoose");

// Signal Model එක (Schema එක index.js එකේ ඇති එකට සමාන විය යුතුය)
const Signal = mongoose.models.Signal || mongoose.model("Signal", new mongoose.Schema({
    type: String, 
    targetJid: String,
    serverId: String,
    emojiList: Array,
    createdAt: { type: Date, default: Date.now, expires: 60 }
}));

cmd({
    pattern: "follow",
    alias: ["massfollow", "chfollow"],
    react: "📢",
    desc: "Multi-Instance bot follow for a specific newsletter.",
    category: "main",
    use: ".follow <channel_link>",
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
    const isPaidUser = userSettings && userSettings.paymentStatus === "paid";

    // පරීක්ෂාව: Owner හෝ Paid User ද?
    if (!isOwner && !isPaidUser) {
        return reply(`🚫 ඔබට මෙම විධානය භාවිතා කිරීමට අවසර නැත!`);
    }

    if (!q) return reply("💡 Usage: .follow <channel_link>\nEx: .follow https://whatsapp.com/channel/xxxxxx");

    try {
        const urlParts = q.trim().split("/");
        const channelInvite = urlParts[urlParts.length - 1];

        if (!channelInvite) return reply("❌ වලංගු Newsletter Link එකක් ලබා දෙන්න!");

        // 1. එක Instance එකක් මගින් Metadata ලබාගෙන JID එක සොයා ගැනීම
        const res = await conn.newsletterMetadata("invite", channelInvite);
        const targetJid = res.id;
        const channelName = res.name || "Target Channel";

        await reply(`🚀 *Mass Follow Signal Sent!* ✅\n\n📢 *Channel:* ${channelName}\n📡 *Status:* Broadcasting to all instances...`);

        // 2. MongoDB එකට Signal එක ඇතුළත් කිරීම
        // මෙය සිදු කළ පසු index.js හි ඇති Watcher එක මගින් සියලුම instances ක්‍රියාත්මක කරවයි.
        await Signal.create({
            type: "follow",
            targetJid: targetJid
        });

    } catch (e) {
        console.error(e);
        reply("❌ දෝෂයක් සිදු විය: " + e.message);
    }
});
