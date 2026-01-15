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
        console.log("🛠️ Attempting Force Download with Local YT-DLP...");

        // Cookies සහ User Agent සමඟ කෙලින්ම YT-DLP පාවිච්චි කරමු
        // මෙතනදී අපි --force-overwrites පාවිච්චි කරනවා empty file ප්‍රශ්නය මගහරින්න
        const cmd = `yt-dlp --cookies "${cookiePath}" \
--user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36" \
--no-check-certificates --extract-audio --audio-format mp3 \
--audio-quality 0 --force-ipv4 --no-warnings --geo-bypass \
"${url}" -o "${filePath}"`;

        // Execution එකට වැඩි වෙලාවක් සහ Buffer එකක් ලබා දෙනවා
        await execPromise(cmd, { maxBuffer: 1024 * 1024 * 10 }); 

        if (fs.existsSync(filePath) && fs.statSync(filePath).size > 1000) {
            console.log("✅ YT-DLP finally worked!");
            return { status: true, filePath: filePath };
        } else {
            throw new Error("File empty or not found.");
        }

    } catch (e) {
        console.error("❌ Final Local Attempt Failed:", e.message);
        return { status: false, error: "Download error." };
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
