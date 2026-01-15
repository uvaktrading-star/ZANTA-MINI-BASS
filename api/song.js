const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs');
const axios = require('axios'); // මේක අනිවාර්යයෙන් ඕනේ
const execPromise = promisify(exec);

async function getAudioFile(url) {
    const fileName = `temp_${Date.now()}.mp3`;
    const tempDir = path.join(__dirname, '..', 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    const filePath = path.join(tempDir, fileName);

    try {
        // --- 1. පියවර: YT-DLP එකෙන් උත්සාහ කිරීම ---
        const cmd = `yt-dlp --force-ipv4 --no-check-certificates "${url}" -x --audio-format mp3 -o "${filePath}"`;
        await execPromise(cmd);
        return { status: true, filePath: filePath };

    } catch (e) {
        console.log("YT-DLP Failed! Switching to API Fallback...");

        try {
            // --- 2. පියවර: YT-DLP fail වුණොත් API එකෙන් ගැනීම ---
            const apiUrl = `https://api.giftedtech.my.id/api/download/dlmp3?url=${encodeURIComponent(url)}&apikey=gifted`;
            const res = await axios.get(apiUrl);
            
            if (res.data.status !== 200) throw new Error("API Status Error");
            const downloadUrl = res.data.result.download_url;

            const writer = fs.createWriteStream(filePath);
            const response = await axios({ url: downloadUrl, method: 'GET', responseType: 'stream' });
            response.data.pipe(writer);

            return new Promise((resolve) => {
                writer.on('finish', () => resolve({ status: true, filePath: filePath }));
                writer.on('error', (err) => resolve({ status: false, error: "Fallback Download Failed" }));
            });

        } catch (apiErr) {
            console.error("All methods failed for Audio:", apiErr.message);
            return { status: false, error: "Updating this cmd.please try again later.." };
        }
    }
}

async function getVideoFile(url) {
    const fileName = `temp_vid_${Date.now()}.mp4`;
    const tempDir = path.join(__dirname, '..', 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    const filePath = path.join(tempDir, fileName);

    try {
        // --- 1. පියවර: YT-DLP එකෙන් උත්සාහ කිරීම ---
        const cmd = `yt-dlp --force-ipv4 --no-check-certificates "${url}" -f "bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480]/best" --recode-video mp4 -o "${filePath}"`;
        await execPromise(cmd);
        return { status: true, filePath: filePath };

    } catch (e) {
        console.log("YT-DLP Video Failed! Switching to API Fallback...");

        try {
            // --- 2. පියවර: API Fallback ---
            // වෙනත් API එකක් වීඩියෝ සඳහා (උදාහරණයක් ලෙස)
            const apiUrl = `https://api.giftedtech.my.id/api/download/dlmp4?url=${encodeURIComponent(url)}&apikey=gifted`;
            const res = await axios.get(apiUrl);
            
            if (res.data.status !== 200) throw new Error("API Status Error");
            const downloadUrl = res.data.result.download_url;

            const writer = fs.createWriteStream(filePath);
            const response = await axios({ url: downloadUrl, method: 'GET', responseType: 'stream' });
            response.data.pipe(writer);

            return new Promise((resolve) => {
                writer.on('finish', () => resolve({ status: true, filePath: filePath }));
                writer.on('error', (err) => resolve({ status: false, error: "Fallback Video Failed" }));
            });

        } catch (apiErr) {
            console.error("All methods failed for Video:", apiErr.message);
            return { status: false, error: "වීඩියෝව ලබාගත නොහැක." };
        }
    }
}

module.exports = { getAudioFile, getVideoFile };
