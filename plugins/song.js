const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp3, ytmp4} = require("sadaslk-dlcore");
const config = require("../config");

async function getYoutube(query) {
  const isUrl = /(youtube\.com|youtu\.be)/i.test(query);
  if (isUrl) {
    const id = query.split("v=")[1] || query.split("/").pop();
    const info = await yts({ videoId: id });
    return info;
  }

  const search = await yts(query);
  if (!search.videos.length) return null;
  return search.videos[0];
}


cmd(
  {
    pattern: "song",
    alias: ["yta", "ytmp3"],
    desc: "Download YouTube MP3 by name or link",
    category: "download",
    filename: __filename,
  },
  async (bot, mek, m, { from, q, reply }) => {
    try {
      if (!q) return reply("🎵 Send song name or YouTube link");

      reply("🔎 Searching YouTube...");
      const video = await getYoutube(q);
      if (!video) return reply("❌ No results found");

      const caption =
        `🎵 *${video.title}*\n\n` +
        `👤 Channel: ${video.author.name}\n` +
        `⏱ Duration: ${video.timestamp}\n` +
        `👀 Views: ${video.views.toLocaleString()}\n` +
        `🔗 ${video.url}`;

      await bot.sendMessage(
        from,
        {
          image: { url: video.thumbnail },
          caption,
        },
        { quoted: mek }
      );

      const data = await ytmp3(video.url);
      if (!data?.url) return reply("❌ Failed to download MP3");

      await bot.sendMessage(
        from,
        {
          audio: { url: data.url },
          mimetype: "audio/mpeg",
        },
        { quoted: mek }
      );
    } catch (e) {
      console.log("YTMP3 ERROR:", e);
      reply("❌ Error while downloading MP3");
    }
  }
);

// --- GSONG COMMAND ---
cmd({
    pattern: "gsong",
    desc: "Send song to groups via Sadas Downloader",
    category: "download",
    use: ".gsong <group_jid> <song_name>",
    filename: __filename
},
async (zanta, mek, m, { from, q, reply, isOwner, userSettings }) => {
    try {
        if (!isOwner) return reply("❌ අයිතිකරුට පමණි.");
        if (!q) return reply("⚠️ භාවිතා කරන ආකාරය: .gsong <jid> <song_name>");

        const args = q.split(" ");
        const targetJid = args[0].trim(); 
        const songName = args.slice(1).join(" "); 

        if (!targetJid.includes("@")) return reply("⚠️ කරුණාකර නිවැරදි Group JID එකක් ලබා දෙන්න.");
        if (!songName) return reply("⚠️ කරුණාකර සින්දුවේ නම ලබා දෙන්න.");

        const settings = userSettings || global.CURRENT_BOT_SETTINGS || {};
        const botName = settings.botName || "ZANTA-MD";

        await m.react("🔍");

        // YouTube සෙවීම
        const video = await getYoutube(songName);
        if (!video) return reply("❌ සින්දුව සොයාගත නොහැකි විය.");

        // විනාඩි 40 සීමාව (2400 seconds)
        if (video.seconds > 2400) { 
            return reply(`⚠️ *සින්දුව ගොඩක් දිග වැඩියි!* (Max: 40 Mins)`);
        }

        const timeLine = "───●──────────"; 
        const imageCaption = `✨ *${botName.toUpperCase()} G-SONG SHARE* ✨\n\n` +
                             `📝 *Title:* ${video.title}\n` +
                             `🕒 *Duration:* ${video.timestamp}\n` +
                             `👥 *Target Group:* ${targetJid}\n\n` +
                             `   ${timeLine}\n` +
                             `   ⇆ㅤㅤ◁ㅤ❚❚ㅤ▷ㅤ↻`;

        // මුලින්ම Thumbnail එක අදාළ ගෘෘප් එකට යැවීම
        await zanta.sendMessage(targetJid, { 
            image: { url: video.thumbnail }, 
            caption: imageCaption 
        });

        await m.react("📥");

        // sadas-conn හි ඇති ytmp3 පාවිච්චි කර download කිරීම
        // සටහන: ඔබේ package එකේ function එක "ytmp3" නම් පමණක් මෙය වැඩ කරයි.
        const songData = await ytmp3(video.url);
        
        // sadas response එක check කිරීම (සමහර විට songData.url ලෙස හෝ songData.download.url ලෙස තිබිය හැක)
        const downloadUrl = songData.url || (songData.download && songData.download.url);

        if (!downloadUrl) {
            return reply("❌ Download link එක ලබා ගැනීමට නොහැකි විය.");
        }

        // අදාළ ගෘෘප් එකට Audio එක යැවීම
        await zanta.sendMessage(targetJid, { 
            audio: { url: downloadUrl }, 
            mimetype: 'audio/mpeg', 
            ptt: false, 
            fileName: `${video.title}.mp3`
        }, { quoted: null });

        await m.react("✅");
        await reply(`🚀 *Successfully Shared to Group!*`);

    } catch (e) {
        console.error("GSong Error:", e);
        reply(`❌ Error: ${e.message}`);
    }
});

cmd(
  {
    pattern: "ytmp4",
    alias: ["ytv", "video"],
    desc: "Download YouTube MP4 by name or link",
    category: "download",
    filename: __filename,
  },
  async (bot, mek, m, { from, q, reply }) => {
    try {
      if (!q) return reply("🎬 Send video name or YouTube link");

      reply("🔎 Searching YouTube...");
      const video = await getYoutube(q);
      if (!video) return reply("❌ No results found");

      const caption =
        `🎬 *${video.title}*\n\n` +
        `👤 Channel: ${video.author.name}\n` +
        `⏱ Duration: ${video.timestamp}\n` +
        `👀 Views: ${video.views.toLocaleString()}\n` +
        `📅 Uploaded: ${video.ago}\n` +
        `🔗 ${video.url}`;

      await bot.sendMessage(
        from,
        {
          image: { url: video.thumbnail },
          caption,
        },
        { quoted: mek }
      );

      reply("⬇️ Downloading video...");

      const data = await ytmp4(video.url, {
        format: "mp4",
        videoQuality: "360",
      });

      if (!data?.url) return reply("❌ Failed to download video");

await bot.sendMessage(
  from,
  {
    video: { url: data.url },
    mimetype: "video/mp4",
    fileName: data.filename || "youtube_video.mp4",
    caption: "🎬 YouTube video",
    gifPlayback: false,
  },
  { quoted: mek }
);
    } catch (e) {
      console.log("YTMP4 ERROR:", e);
      reply("❌ Error while downloading video");
    }
  }
);
