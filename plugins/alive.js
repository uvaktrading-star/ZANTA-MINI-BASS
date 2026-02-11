const { cmd, commands } = require('../command');
const config = require('../config');
const aliveMsg = require('./aliveMsg');
const axios = require('axios'); 

const CHANNEL_JID = "120363406265537739@newsletter"; 

// --- 🖼️ IMAGE PRE-LOAD LOGIC ---
let cachedAliveImage = null;

async function preLoadAliveImage() {
    try {
        const imageUrl = config.ALIVE_IMG || "https://github.com/Akashkavindu/ZANTA_MD/blob/main/images/zanta-md.png?raw=true";
        const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        cachedAliveImage = Buffer.from(response.data);
    } catch (e) {
        cachedAliveImage = null; 
    }
}

preLoadAliveImage();

cmd({
    pattern: "alive",
    react: "🤖",
    desc: "Check if the bot is online.",
    category: "main",
    filename: __filename
},
async (zanta, mek, m, { from, reply, userSettings, prefix }) => {
    try {
        const settings = userSettings || global.CURRENT_BOT_SETTINGS || {};
        const botName = settings.botName || config.DEFAULT_BOT_NAME || "ZANTA-MD";
        const finalPrefix = prefix || settings.prefix || config.DEFAULT_PREFIX || ".";

        // Placeholder replace කිරීම
        const finalMsg = aliveMsg.getAliveMessage()
            .replace(/{BOT_NAME}/g, botName)
            .replace(/{OWNER_NUMBER}/g, config.OWNER_NUMBER)
            .replace(/{PREFIX}/g, finalPrefix);

        // --- 🖼️ IMAGE LOGIC ---
        let imageToDisplay;
        if (settings.botImage && settings.botImage !== "null" && settings.botImage.startsWith("http")) {
            imageToDisplay = { url: settings.botImage };
        } else {
            imageToDisplay = cachedAliveImage || { url: config.ALIVE_IMG || "https://github.com/Akashkavindu/ZANTA_MD/blob/main/images/zanta-md.png?raw=true" };
        }

        const contextInfo = {
            forwardingScore: 999,
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
                newsletterJid: CHANNEL_JID,
                serverMessageId: 100,
                newsletterName: "𝒁𝑨𝑵𝑻𝑨-𝑴𝑫 𝑶𝑭𝑭𝑰𝑪𝑰𝑨𝑳 </>"
            }
        };

        // --- 🟢 SEND IMAGE + TEXT MSG ---
        await zanta.sendMessage(from, {
            image: imageToDisplay,
            caption: finalMsg,
            contextInfo: contextInfo
        }, { quoted: mek });

        // --- 🎤 SEND ALIVE VOICE REPLY ---
        try {
            // මෙතනට Alive එකට ඕන කරන voice ලින්ක් එක දෙන්න (දැනට gm.mp3 දාලා ඇති)
            const aliveVoiceUrl = 'https://github.com/Akashkavindu/ZANTA_MD/raw/main/images/alive.mp3'; 
            
            const vResponse = await axios.get(aliveVoiceUrl, { responseType: 'arraybuffer' });
            const vBuffer = Buffer.from(vResponse.data, 'utf-8');

            await zanta.sendMessage(from, { 
                audio: vBuffer, 
                mimetype: 'audio/mpeg', 
                ptt: false, // iPhone/Android දෙකටම ෂුවර් වැඩ කරන ක්‍රමය
                fileName: 'Alive.mp3'
            }, { quoted: mek });

        } catch (voiceError) {
            console.error("[ALIVE VOICE ERROR]", voiceError.message);
        }

    } catch (e) {
        console.error("[ALIVE ERROR]", e);
        reply(`❌ Error: ${e.message}`);
    }
});
