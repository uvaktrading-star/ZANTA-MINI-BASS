const { cmd } = require("../command");
const os = require('os');
const { runtime } = require('../lib/functions');
const config = require("../config");
const axios = require('axios'); // පින්තූරය කලින් ලබා ගැනීමට

const STATUS_IMAGE_URL = "https://github.com/Akashkavindu/ZANTA_MD/blob/main/images/Gemini_Generated_Image_4xcl2e4xcl2e4xcl.png?raw=true";

// --- 🖼️ IMAGE PRE-LOAD LOGIC ---
let cachedStatusImage = null;

async function preLoadStatusImage() {
    try {
        const response = await axios.get(STATUS_IMAGE_URL, { responseType: 'arraybuffer' });
        cachedStatusImage = Buffer.from(response.data);
        console.log("✅ [CACHE] System status image pre-loaded.");
    } catch (e) {
        console.error("❌ [CACHE] Failed to pre-load system image:", e.message);
        cachedStatusImage = { url: STATUS_IMAGE_URL };
    }
}

// බොට් පණ ගැන්වෙන විටම පින්තූරය ලබා ගැනීම
preLoadStatusImage();

// දත්ත ප්‍රමාණයන් කියවීමට පහසු ලෙස සැකසීම
function bytesToSize(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Byte';
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
    return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + sizes[i];
}

cmd({
    pattern: "system",
    alias: ["status", "info"],
    react: "⚙️",
    desc: "Check bot speed and system status.",
    category: "main",
    filename: __filename,
},
async (zanta, mek, m, { from, userSettings }) => {
    try {
        const startTime = Date.now();
        const settings = userSettings || global.CURRENT_BOT_SETTINGS || {};
        const botName = settings.botName || config.DEFAULT_BOT_NAME || "ZANTA-MD";

        // Loading message
        const loadingMsg = await zanta.sendMessage(from, { text: "⚙️ *Checking System Status...*" }, { quoted: mek });

        // Memory usage දත්ත ලබා ගැනීම
        const memoryUsage = process.memoryUsage();
        const latency = Date.now() - startTime;

        const statusMessage = `
🚀 *${botName} SYSTEM INFO* 🚀

*⚡ LATENCY:* ${latency} ms
*🕒 UPTIME:* ${runtime(process.uptime())}

*💻 PROCESS RESOURCES:*
*┃ 🧠 Total Memory:* ${bytesToSize(memoryUsage.rss)}
*┃ 📦 Heap Used:* ${bytesToSize(memoryUsage.heapUsed)}
*┃ 🏛️ Platform:* ${os.platform()} (${os.arch()})

> *© ${botName} STATUS REPORT*`.trim();

        // Cached පින්තූරය තිබේ නම් එය භාවිතා කරයි, නැතිනම් URL එක පාවිච්චි කරයි
        const imageToDisplay = cachedStatusImage || { url: STATUS_IMAGE_URL };

        // අවසාන පණිවිඩය රූපය සමඟ යැවීම
        await zanta.sendMessage(from, {
            image: imageToDisplay,
            caption: statusMessage
        }, { quoted: mek });

        // පැරණි පණිවිඩය මැකීම
        await zanta.sendMessage(from, { delete: loadingMsg.key });

    } catch (e) {
        console.error("[PING ERROR]", e);
    }
});
