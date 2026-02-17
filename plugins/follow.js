const { cmd } = require('../command');
const mongoose = require("mongoose");

// Signal Model - Dashboard එකේ Payload එකට ගැලපෙන සේ Strict: false ලෙස
const Signal = mongoose.models.Signal || mongoose.model("Signal", new mongoose.Schema({}, { strict: false }));

cmd({
    pattern: "follow",
    alias: ["massfollow", "chfollow"],
    react: "📢",
    desc: "Multi-Instance bot follow with node distribution logic.",
    category: "main",
    use: ".follow [Channel_Link] , [Qty]",
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

    if (!isOwner && !isPaidUser) {
        return reply(`🚫 ඔබට මෙම විධානය භාවිතා කිරීමට අවසර නැත!`);
    }

    // Input format: .follow link , qty
    if (!q || !q.includes(",")) return reply("💡 Usage: .follow [Link] , [Qty]\nEx: .follow https://whatsapp.com/channel/xxx , 100");

    try {
        let [linkPart, qtyPart] = q.split(",");
        linkPart = linkPart.trim();
        let qtyNum = parseInt(qtyPart?.trim()) || 50;

        if (!linkPart.includes('whatsapp.com/channel/')) return reply("❌ වලංගු Newsletter Link එකක් ලබා දෙන්න!");
        if (qtyNum < 10 || qtyNum > 500) return reply("⚠️ Quantity එක 10 ත් 500 ත් අතර විය යුතුය.");

        const urlParts = linkPart.split("/");
        const channelInvite = urlParts[urlParts.length - 1];

        // 1. Metadata ලබාගෙන JID එක සොයා ගැනීම
        const res = await conn.newsletterMetadata("invite", channelInvite);
        const targetJid = res.id;
        const channelName = res.name || "Target Channel";

        // --- 📊 MULTI-NODE PAYLOAD LOGIC (Dashboard Logic) ---
        const signalPayload = {
            type: "follow",
            targetJid: targetJid,
            timestamp: Date.now()
        };

        const USERS_PER_APP = 50;
        let remaining = qtyNum + 10; // 10 buffer users
        let appIdCounter = 1;

        // Dashboard එකේ වගේම Quantity එක Nodes වලට බෙදා වෙන් කිරීම
        while (remaining > 0) {
            const batchSize = Math.min(remaining, USERS_PER_APP);
            const keyName = `APP_ID_${appIdCounter}`;
            signalPayload[keyName] = batchSize.toString();
            
            remaining -= batchSize;
            appIdCounter++;
        }

        // 2. MongoDB එකට Signal එක ඇතුළත් කිරීම
        await Signal.create(signalPayload);

        return reply(`🚀 *FOLLOW STRIKE INITIATED!* ✅\n\n📢 *Channel:* ${channelName}\n💠 *Nodes Active:* ${appIdCounter - 1}\n🔢 *Target Qty:* ${qtyNum}\n📡 *Status:* Broadcasting...`);

    } catch (e) {
        console.error(e);
        reply("❌ දෝෂයක් සිදු විය: " + e.message);
    }
});
