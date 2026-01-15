const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs');
const execPromise = promisify(exec);

async function getAudioFile(url) {
    const fileName = `temp_${Date.now()}.mp3`;
    const tempDir = path.join(__dirname, '..', 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    const filePath = path.join(tempDir, fileName);
    const cookiePath = path.join(__dirname, '..', 'cookies.txt');

    try {
        console.log("🛠️ Executing Final YT-DLP Command...");

        // බ්ලොක් වීම් වැළැක්වීමට අලුත්ම parameters මෙහි අන්තර්ගතයි
        const cmd = `yt-dlp --cookies "${cookiePath}" \
--user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" \
--no-check-certificates --extract-audio --audio-format mp3 \
--audio-quality 0 --force-ipv4 --no-warnings \
"${url}" -o "${filePath}"`;

        await execPromise(cmd);

        if (fs.existsSync(filePath) && fs.statSync(filePath).size > 1000) {
            console.log("✅ Success: Audio file generated!");
            return { status: true, filePath: filePath };
        } else {
            throw new Error("Download completed but file is invalid or empty.");
        }

    } catch (e) {
        console.error("❌ YT-DLP Error:", e.message);
        return { status: false, error: "Download failed." };
    }
}

async function getVideoFile(url) {
    const fileName = `temp_vid_${Date.now()}.mp4`;
    const tempDir = path.join(__dirname, '..', 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    const filePath = path.join(tempDir, fileName);
    const cookiePath = path.join(__dirname, '..', 'cookies.txt');

    try {
        const cmd = `yt-dlp --cookies "${cookiePath}" -f "bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480]/best" --recode-video mp4 --no-warnings "${url}" -o "${filePath}"`;
        await execPromise(cmd);
        return { status: true, filePath: filePath };
    } catch (e) {
        return { status: false };
    }
}

module.exports = { getAudioFile, getVideoFile };
