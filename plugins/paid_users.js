const { cmd } = require('../command');
const { updateSetting } = require('../plugins/bot_db');

// 🛡️ අවසර ලත් අංක (Owner only)
const allowedNumbers = ["94771810698", "94743404814", "94766247995", "192063001874499", "270819766866076"];

cmd({
    pattern: "pay",
    alias: ["setuser"],
    react: "👤",
    desc: "Update user payment status (paid/unpaid).",
    category: "main",
    use: ".user [JID/Number], [status]",
    filename: __filename,
}, async (conn, mek, m, { q, reply, sender }) => {

    const senderNumber = sender.split("@")[0].replace(/[^\d]/g, '');
    if (!allowedNumbers.includes(senderNumber)) return reply("🚫මෙම පහසුකම භාවිතා කිරීමට ඔබට අවසර නැත\n\n> Contact owner\nhttp://wa.me/+94766247995?text=*Zanta+Channel+React*");

    if (!q.includes(",")) return reply("💡 Usage: .user 9477xxxxxxx, paid\n(Status can be paid or unpaid)");

    let [targetNum, status] = q.split(",").map(v => v.trim());

    if (!targetNum || !status) return reply("⚠️ කරුණාකර අංකය සහ තත්ත්වය (status) නිවැරදිව ලබා දෙන්න.");

    // අංකය පමණක් පිරිසිදු කර ගැනීම
    const targetId = targetNum.replace(/[^\d]/g, '');
    const finalStatus = status.toLowerCase();

    try {
        // Database එකේ අදාළ User ගේ settings update කිරීම
        // මෙහිදී targetId ලෙස යොදාගන්නේ updateSetting function එකට අවශ්‍ය පිරිසිදු අංකයයි
        const success = await updateSetting(targetId, 'paymentStatus', finalStatus);

        if (success) {
            // Memory sync (අදාළ user දැනටමත් session එකේ ඉන්නවා නම් පමණක්)
            if (global.BOT_SESSIONS_CONFIG && global.BOT_SESSIONS_CONFIG[targetId]) {
                global.BOT_SESSIONS_CONFIG[targetId].paymentStatus = finalStatus;
            }

            reply(`✅ *USER UPDATED*\n\n👤 *User:* ${targetId}\n💳 *Status:* ${finalStatus.toUpperCase()}\n📅 *Updated At:* ${new Date().toLocaleString()}`);
        } else {
            reply("❌ Database එක update කිරීමේදී දෝෂයක් සිදු විය.");
        }

    } catch (e) {
        console.error(e);
        reply("❌ Error: " + e.message);
    }
});
