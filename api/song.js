const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const execPromise = promisify(exec);

async function getAudioFile(url) {
    const fileName = `temp_${Date.now()}.mp3`;
    const tempDir = path.join(__dirname, '..', 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    const filePath = path.join(tempDir, fileName);

    console.log("🚀 Starting Download for:", url);

    try {
        console.log("🔍 Trying YT-DLP...");
        const cmd = `yt-dlp --force-ipv4 --no-check-certificates "${url}" -x --audio-format mp3 -o "${filePath}"`;
        await execPromise(cmd);
        
        if (fs.existsSync(filePath)) {
            console.log("✅ YT-DLP Success:", filePath);
            return { status: true, filePath: filePath };
        } else {
            throw new Error("File not created by YT-DLP");
        }

    } catch (e) {
        console.log("⚠️ YT-DLP Failed. Trying Fallback API...");

        try {
            const apiUrl = `https://api.giftedtech.my.id/api/download/dlmp3?url=${encodeURIComponent(url)}&apikey=gifted`;
            const res = await axios.get(apiUrl);
            
            if (!res.data || !res.data.result) throw new Error("Invalid API Response");
            const downloadUrl = res.data.result.download_url;

            console.log("📥 Downloading from API Stream...");
            const writer = fs.createWriteStream(filePath);
            const response = await axios({ url: downloadUrl, method: 'GET', responseType: 'stream' });
            
            response.data.pipe(writer);

            return new Promise((resolve) => {
                writer.on('finish', () => {
                    console.log("✅ API Download Success:", filePath);
                    resolve({ status: true, filePath: filePath });
                });
                writer.on('error', (err) => {
                    console.log("❌ API Writer Error:", err.message);
                    resolve({ status: false, error: err.message });
                });
            });

        } catch (apiErr) {
            console.error("❌ All methods failed:", apiErr.message);
            return { status: false, error: "Download failed" };
        }
    }
}

// Video function එකටත් මේ වගේම logs ටිකක් දාගන්න.
async function getVideoFile(url) {
    const fileName = `temp_vid_${Date.now()}.mp4`;
    const tempDir = path.join(__dirname, '..', 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    const filePath = path.join(tempDir, fileName);

    try {
        console.log("🔍 Trying Video YT-DLP...");
        const cmd = `yt-dlp --force-ipv4 --no-check-certificates "${url}" -f "bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480]/best" --recode-video mp4 -o "${filePath}"`;
        await execPromise(cmd);
        return { status: true, filePath: filePath };
    } catch (e) {
        console.log("⚠️ Video YT-DLP Failed. Trying Fallback...");
        try {
            const apiUrl = `https://api.giftedtech.my.id/api/download/dlmp4?url=${encodeURIComponent(url)}&apikey=gifted`;
            const res = await axios.get(apiUrl);
            const downloadUrl = res.data.result.download_url;
            const writer = fs.createWriteStream(filePath);
            const response = await axios({ url: downloadUrl, method: 'GET', responseType: 'stream' });
            response.data.pipe(writer);
            return new Promise((resolve) => {
                writer.on('finish', () => resolve({ status: true, filePath: filePath }));
                writer.on('error', () => resolve({ status: false }));
            });
        } catch (err) {
            return { status: false };
        }
    }
}

module.exports = { getAudioFile, getVideoFile };
