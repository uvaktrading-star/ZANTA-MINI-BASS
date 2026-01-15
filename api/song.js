const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs');
const execPromise = promisify(exec);

// Cookies ෆයිල් එක තියෙන්නේ Bot Root එකේ කියලා උපකල්පනය කරනවා
const cookiesPath = path.join(__dirname, '..', 'cookies.txt');

async function getAudioFile(url) {
    try {
        const fileName = `temp_${Date.now()}.mp3`;
        const tempDir = path.join(__dirname, '..', 'temp');
        
        // temp ෆෝල්ඩර් එක නැත්නම් හදනවා
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
        
        const filePath = path.join(tempDir, fileName); 

        // cookies.txt තියෙනවා නම් විතරක් argument එක එකතු කරනවා
        const cookiesArg = fs.existsSync(cookiesPath) ? `--cookies "${cookiesPath}"` : "";

        // YouTube Block bypass කිරීමට අවශ්‍ය arguments
        const extraArgs = `--extractor-args "youtube:player_client=ios,android;player_skip=webpage,configs"`;
        const userAgent = `--user-agent "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"`;

        // සම්පූර්ණ Command එක
        const cmd = `yt-dlp ${cookiesArg} ${extraArgs} ${userAgent} --no-check-certificates "${url}" -x --audio-format mp3 -o "${filePath}"`;

        await execPromise(cmd);
        return { status: true, filePath: filePath };
    } catch (e) {
        console.error("YT-DLP Audio Error:", e);
        return { status: false, error: e.message };
    }
}

async function getVideoFile(url) {
    try {
        const fileName = `temp_vid_${Date.now()}.mp4`;
        const tempDir = path.join(__dirname, '..', 'temp');
        
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
        
        const filePath = path.join(tempDir, fileName);

        const cookiesArg = fs.existsSync(cookiesPath) ? `--cookies "${cookiesPath}"` : "";
        const extraArgs = `--extractor-args "youtube:player_client=ios,android;player_skip=webpage,configs"`;
        const userAgent = `--user-agent "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"`;

        // Video format එක 480p වලට limit කරලා තියෙන්නේ size එක අඩු කරන්න
        const cmd = `yt-dlp ${cookiesArg} ${extraArgs} ${userAgent} --no-check-certificates "${url}" -f "bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480]/best" --recode-video mp4 -o "${filePath}"`;

        await execPromise(cmd);
        return { status: true, filePath: filePath };
    } catch (e) {
        console.error("YT-DLP Video Error:", e);
        return { status: false, error: e.message };
    }
}

module.exports = { getAudioFile, getVideoFile };
