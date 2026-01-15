const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs');
const execPromise = promisify(exec);

const cookiesPath = path.join(__dirname, '..', 'cookies.txt');

async function getAudioFile(url) {
    try {
        const fileName = `temp_${Date.now()}.mp3`;
        const filePath = path.join(__dirname, '..', 'temp', fileName); 

        const cookiesArg = fs.existsSync(cookiesPath) ? `--cookies "${cookiesPath}"` : "";

        // YouTube බ්ලොක් එක බයිපාස් කරන්න iOS (iPhone) Client එක පාවිච්චි කරනවා
        const extraArgs = `--extractor-args "youtube:player_client=ios,android;player_skip=webpage,configs"`;
        const userAgent = `--user-agent "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"`;

        const cmd = `yt-dlp ${cookiesArg} ${extraArgs} ${userAgent} "${url}" -x --audio-format mp3 -o "${filePath}"`;

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
        const filePath = path.join(__dirname, '..', 'temp', fileName);

        const cookiesArg = fs.existsSync(cookiesPath) ? `--cookies "${cookiesPath}"` : "";
        const extraArgs = `--extractor-args "youtube:player_client=ios,android;player_skip=webpage,configs"`;
        const userAgent = `--user-agent "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"`;

        const cmd = `yt-dlp ${cookiesArg} ${extraArgs} ${userAgent} "${url}" -f "bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480]/best" --recode-video mp4 -o "${filePath}"`;

        await execPromise(cmd);
        return { status: true, filePath: filePath };
    } catch (e) {
        console.error("YT-DLP Video Error:", e);
        return { status: false, error: e.message };
    }
}

module.exports = { getAudioFile, getVideoFile };
