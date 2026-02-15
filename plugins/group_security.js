const { cmd } = require("../command");

// --- 🛠️ LID/JID ඇඩ්මින් ප්‍රශ්නය විසඳන Function එක ---
const getLastDigits = (jid) => {
    if (!jid) return "";
    let clean = jid.split('@')[0].split(':')[0]; 
    return clean.slice(-8); 
};

// --- 🛡️ PERMISSION CHECKER ---
const checkPerms = (zanta, m, groupAdmins, isOwner, sender) => {
    const adminDigitsList = (groupAdmins || []).map(ad => getLastDigits(ad));
    const botDigits = getLastDigits(zanta.user.lid || zanta.user.id);
    const userDigits = getLastDigits(m.senderLid || sender);

    const isBotAdmin = adminDigitsList.includes(botDigits);
    const isUserAdmin = adminDigitsList.includes(userDigits);

    if (!isBotAdmin) return "bot_not_admin";
    if (isOwner || isUserAdmin) return "is_admin_or_owner";
    return "ok";
};

// --- 🛡️ MAIN SECURITY HANDLER ---
cmd({
    on: "body" // හැම මැසේජ් එකක්ම Check කිරීමට
}, async (zanta, mek, m, { from, body, isGroup, groupAdmins, isOwner, sender, userSettings, reply }) => {
    
    if (!isGroup) return;

    // 1. Permission Check (බොට් Admin ද සහ එවපු කෙනා Admin ද කියලා බලනවා)
    const perm = checkPerms(zanta, m, groupAdmins, isOwner, sender);
    
    // බොට් Admin නෙවෙයි නම් මුකුත් කරන්න බැහැ
    if (perm === "bot_not_admin") return;
    
    // එවපු කෙනා Admin හෝ Owner නම් කිසිම Security එකක් එයාට බලපාන්නේ නැහැ
    if (perm === "is_admin_or_owner") return;

    const text = body.toLowerCase();

    // --- 🚫 1. ANTI-BAD WORDS LOGIC ---
    if (userSettings.badWords === "true") {
        const badWords = ["ponnaya", "hukana", "pakaya", "kari", "hutto", "ponna", "paka"]; // උඹට ඕන වචන මෙතනට දාපන්
        const hasBadWord = badWords.some(word => text.includes(word));

        if (hasBadWord) {
            await zanta.sendMessage(from, { delete: mek.key });
            return await zanta.sendMessage(from, { 
                text: `🚫 *BAD WORDS DETECTED* \n\n@${sender.split('@')[0]} කරුණාකර කුණුහරුප භාවිතයෙන් වළකින්න!`,
                mentions: [sender]
            });
        }
    }

    // --- 🔗 2. ANTI-LINK LOGIC ---
    if (userSettings.antiLink === "true") {
        const linkPattern = /chat.whatsapp.com\/(?:invite\/)?([a-zA-Z0-9_-]{22})/i;
        if (linkPattern.test(text)) {
            await zanta.sendMessage(from, { delete: mek.key });
            return await zanta.sendMessage(from, { 
                text: `⚠️ *LINK DETECTED* \n\n@${sender.split('@')[0]} මෙම සමූහය තුළ ලින්ක් බෙදාහැරීම තහනම්!`,
                mentions: [sender]
            });
        }
    }

    // --- 🤖 3. ANTI-BOT LOGIC ---
    if (userSettings.antiBot === "true") {
        // බොහෝ බොට්ස්ලාගේ Message ID එක පටන් ගන්නේ "BAE5" හෝ "3EB0" වගේ අකුරු වලින්
        const isOtherBot = mek.key.id.startsWith("BAE5") || mek.key.id.startsWith("3EB0") || mek.key.id.length > 21;
        if (isOtherBot) {
            await zanta.sendMessage(from, { delete: mek.key });
            // ඕන නම් බොට්ව අයින් කරන්න (Kick) මේ පහළ line එක පාවිච්චි කරන්න පුළුවන්:
            // await zanta.groupParticipantsUpdate(from, [sender], "remove");
            return;
        }
    }

    // --- ⌨️ 4. ANTI-COMMAND LOGIC ---
    if (userSettings.antiCmd === "true") {
        const otherPrefixes = [".", "/", "!", "#", "?", "-"];
        const isOtherCmd = otherPrefixes.some(p => text.startsWith(p)) && !text.startsWith(userSettings.prefix);
        
        if (isOtherCmd) {
            await zanta.sendMessage(from, { delete: mek.key });
            return;
        }
    }
});
