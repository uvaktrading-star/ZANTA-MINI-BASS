const gis = require("g-i-s");
const { cmd } = require("../command");
const { translate } = require("@vitalets/google-translate-api");
const config = require("../config");
const axios = require("axios");

// 1. JID Finder
cmd(
    {
        pattern: "jid",
        alias: ["myid", "userjid"],
        react: "🆔",
        category: "main",
        filename: __filename,
    },
    async (zanta, mek, m, { from, sender, isGroup, userSettings }) => {
        try {
            const settings = userSettings || global.CURRENT_BOT_SETTINGS || {};
            const botName =
                settings.botName || config.DEFAULT_BOT_NAME || "ZANTA-MD";

            let targetJid;
            let contextMsg = "";

            // 1. මැසේජ් එකක් Quoted කරලා තිබේ නම්
            if (m.quoted) {
                // Forward කරපු මැසේජ් එකක් නම් (චැනල් JID එක මෙතන තියෙන්නේ)
                if (
                    m.quoted.contextInfo &&
                    m.quoted.contextInfo.forwardingScore > 0
                ) {
                    // මෙතනදී newsletter/channel JID එක ගන්නේ මෙහෙමයි
                    targetJid =
                        m.quoted.contextInfo.remoteJid ||
                        m.quoted.contextInfo.participant;
                    contextMsg = "📢 *Forwarded Source JID*";
                }
                // එසේ නොවේ නම් සාමාන්්‍ය Quoted User JID
                else {
                    targetJid = m.quoted.sender;
                    contextMsg = "👤 *Quoted User JID*";
                }
            }
            // 2. කිසිවක් Quoted කර නැත්නම් මැසේජ් එක එවූ Chat එකේ JID
            else {
                // මෙන්න මෙතන තමයි වෙනස් කළේ: 'sender' වෙනුවට 'from' පාවිච්චි කළා
                targetJid = from;
                contextMsg = isGroup
                    ? "🏢 *Current Group JID*"
                    : "👤 *Current Chat JID*";
            }

            let jidMsg = `🆔 *JID INFORMATION*\n\n`;
            jidMsg += `${contextMsg}:\n🎫 \`${targetJid}\`\n`;

            // Sender ගේ JID එකත් අමතරව ඕන නම් මෙහෙම දාන්න පුළුවන්
            if (isGroup || m.quoted) {
                jidMsg += `\n👤 *Your JID:*\n🎫 \`${sender}\`\n`;
            }

            jidMsg += `\n> *© ${botName}*`;

            await zanta.sendMessage(
                from,
                { text: jidMsg, mentions: [sender, targetJid] },
                { quoted: mek },
            );
        } catch (err) {
            console.error(err);
        }
    },
);

cmd({
    pattern: "cjid",
    alias: ["getjid", "jidchannel"],
    desc: "Get WhatsApp Channel JID from Link",
    category: "main",
    use: ".cjid <channel-link>",
    filename: __filename
},
async (zanta, mek, m, { from, args, q, reply, isOwner }) => {
    try {
        // අයිතිකරුට පමණක් අවසර ලබා දීම (අවශ්‍ය නම් පමණක්)
        if (!isOwner) return reply("⚠️ This command is for my Owner only.");

        if (!q) return reply("⚠️ Please provide a WhatsApp Channel link!");

        // ලින්ක් එක චැනල් ලින්ක් එකක්ද කියලා බලන්න
        if (!q.includes("whatsapp.com/channel/")) {
            return reply("❌ Invalid WhatsApp Channel link.");
        }

        // Newsletter Metadata හරහා JID එක ලබා ගැනීම
        const res = await zanta.newsletterMetadata("invite", q.split("channel/")[1]);

        if (res && res.id) {
            let msg = `✨ *ZANTA-MD CHANNEL JID* ✨\n\n`;
            msg += `*JID:* \`${res.id}\`\n\n`;
            msg += `> *Copy the JID to your config.*`;

            return await reply(msg);
        } else {
            return reply("❌ Could not fetch JID. Make sure the link is correct.");
        }

    } catch (e) {
        console.log("CJID Error:", e);
        reply("❌ Error: " + (e.message || "Could not retrieve JID. Try again later."));
    }
});
// 2. Speed Test
cmd(
    {
        pattern: "ping",
        alias: ["bot", "ms"],
        react: "⚡",
        category: "main",
        filename: __filename,
    },
    async (zanta, mek, m, { from, userSettings }) => {
        try {
            const settings = userSettings || global.CURRENT_BOT_SETTINGS || {};
            const botName = settings.botName || config.DEFAULT_BOT_NAME || "ZANTA-MD";
            const startTime = Date.now();

            // මුලින්ම පණිවිඩය යවයි
            const pinger = await zanta.sendMessage(
                from,
                { text: "🚀 *Checking...*" },
                { quoted: mek },
            );
            const ping = Date.now() - startTime;

            // Edit කරන මැසේජ් එකට Channel Context එක එකතු කිරීම
            await zanta.sendMessage(from, {
                text: `⚡ *${botName} SPEED*\n\n🚄 *Latency:* ${ping}ms\n📡 *Status:* Online\n\n> *© ${botName}*`,
                edit: pinger.key,
                contextInfo: {
                    forwardingScore: 999,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: "120363406265537739@newsletter", // 👈 මෙතනට ඔයාගේ නිවැරදි Channel JID එක දාන්න
                        newsletterName: "𝒁𝑨𝑵𝑻𝑨-𝑴𝑫 𝑶𝑭𝑭𝑰𝑪𝑰𝑨𝑳 </>", // 👈 මෙතනට චැනල් එකේ නම දාන්න
                        serverMessageId: 100,
                    },
                },
            });
        } catch (err) {
            console.error(err);
        }
    },
);

// 4. Translator
cmd(
    {
        pattern: "tr",
        alias: ["translate"],
        react: "🌍",
        category: "tools",
        filename: __filename,
    },
    async (zanta, mek, m, { from, reply, q, userSettings }) => {
        try {
            const settings = userSettings || global.CURRENT_BOT_SETTINGS || {};
            const botName =
                settings.botName || config.DEFAULT_BOT_NAME || "ZANTA-MD";
            const text = m.quoted ? m.quoted.body : q;

            if (!text)
                return reply("❤️ *පණිවිඩයකට Reply කරන්න හෝ වචනයක් ලබා දෙන්න.*");

            const loading = await zanta.sendMessage(
                from,
                { text: "🔠 *Translating...*" },
                { quoted: mek },
            );
            const result = await translate(text, { to: "si" });

            await zanta.sendMessage(from, {
                text: `${result.text}\n\n> *© ${botName}*`,
                edit: loading.key,
            });
        } catch (err) {
            reply("❌ *පරිවර්තනය අසාර්ථක විය.*");
        }
    },
);

cmd(
    {
        pattern: "owner",
        alias: ["developer", "dev"],
        react: "👑",
        desc: "Get Owner Details.",
        category: "main",
        filename: __filename,
    },
    async (zanta, mek, m, { from, reply, userSettings }) => {
        try {
            const settings = userSettings || global.CURRENT_BOT_SETTINGS || {};
            const botName =
                settings.botName || config.DEFAULT_BOT_NAME || "ZANTA-MD";

            // ලෝගෝ එක Buffer එකක් ලෙස ලබා ගැනීම
            let logoRes = await axios.get(
                "https://github.com/Akashkavindu/ZANTA_MD/blob/main/images/Gemini_Generated_Image_4xcl2e4xcl2e4xcl.png?raw=true",
                { responseType: "arraybuffer" },
            );
            let logoBuffer = Buffer.from(logoRes.data, "binary");

            // ඔයාගේ විස්තර මෙතන ලස්සනට දාන්න පුළුවන්
            let ownerMsg = `👑 *|${botName.toUpperCase()} OWNER INFO|* 👑

👤 *Name:* Akash kavindu
🌍 *Location:* Sri Lanka 🇱🇰
📱 *WhatsApp:* 94743404814

📢 *Join our Channel:* https://whatsapp.com/channel/0029VbBc42s84OmJ3V1RKd2B

> *©️ 𝐙𝐀𝐍𝐓𝐀 𝐎𝐅𝐂*`;

            // මැසේජ් එක යැවීම
            await zanta.sendMessage(
                from,
                {
                    image: logoBuffer, // ඔයාගේ ලෝගෝ එකම මේකටත් පාවිච්චි කළා
                    caption: ownerMsg,
                },
                { quoted: mek },
            );
        } catch (e) {
            reply(`❌ *Error:* ${e.message}`);
        }
    },
);

cmd(
    {
        pattern: "directdl",
        alias: ["download", "ddl"],
        react: "📥",
        category: "download",
        desc: "Download files from a direct link.",
        filename: __filename,
    },
    async (zanta, mek, m, { from, q, reply }) => {
        if (!q)
            return reply(
                "❌ කරුණාකර Direct Download Link එකක් ලබා දෙන්න.\n\n*Ex:* .directdl https://example.com/file.pdf",
            );

        const urlPattern = /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i;
        if (!urlPattern.test(q))
            return reply(
                "❌ ලබා දුන් Link එක වැරදියි. කරුණාකර නිවැරදි Link එකක් ලබා දෙන්න.",
            );

        try {
            // මුලින්ම File Header එක විතරක් ගෙන සයිස් එක චෙක් කරමු (Stream එකට කලින්)
            const head = await axios.head(q).catch(() => null);
            const sizeInBytes = head?.headers["content-length"];
            const fileSizeMB = sizeInBytes ? (sizeInBytes / (1024 * 1024)).toFixed(2) : 0;

            if (sizeInBytes && parseFloat(fileSizeMB) > 400) {
                return reply(`⚠️ ගොනුවේ ප්‍රමාණය වැඩියි (${fileSizeMB} MB). Max limit is 400MB.`);
            }

            await reply(`⏳ *Downloading File...* ${fileSizeMB > 0 ? `[${fileSizeMB} MB]` : ""}`);

            const fileName = q.substring(q.lastIndexOf("/") + 1).split("?")[0] || "downloaded_file";

            // Streaming Request
            const response = await axios({
                method: "get",
                url: q,
                responseType: "stream",
            });

            // File එක Document එකක් විදිහට Stream එක හරහා යැවීම
            await zanta.sendMessage(
                from,
                {
                    document: { stream: response.data },
                    fileName: fileName,
                    mimetype: response.headers["content-type"] || "application/octet-stream",
                    contentLength: sizeInBytes ? parseInt(sizeInBytes) : null,
                    caption: `✅ *File Downloaded Successfully!*\n\n📂 *Name:* ${fileName}\n⚖️ *Size:* ${fileSizeMB} MB\n\n> *Generated by ZANTA-MD*`,
                },
                { quoted: mek },
            );

            await zanta.sendMessage(from, { react: { text: "✅", key: mek.key } });

        } catch (e) {
            console.error(e);
            reply(
                "❌ ගොනුව බාගත කිරීමට නොහැකි විය. Link එක වැඩ කරන්නේ නැති හෝ Server එක මගින් stream එක block කර ඇති එකක් විය හැක.",
            );
        }
    },
);
