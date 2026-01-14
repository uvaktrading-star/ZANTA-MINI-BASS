const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const execPromise = promisify(exec);

/**
 * YouTube වීඩියෝව සර්වර් එකට Download කර මාර්ගය (Path) ලබා දෙයි.
 */
async function getAudioFile(url) {
    try {
        // සින්දුවේ නම සහ තාවකාලික ෆයිල් නම සැකසීම
        const fileName = `temp_${Date.now()}.mp3`;
        const filePath = path.join(__dirname, '..', 'temp', fileName); 

        // python3 -m කෑල්ල අයින් කර කෙලින්ම yt-dlp පාවිච්චි කිරීම
        const cmd = `yt-dlp "${url}" -x --audio-format mp3 -o "${filePath}"`;

        await execPromise(cmd);
        return {
            status: true,
            filePath: filePath
        };
    } catch (e) {
        console.error("YT-DLP Audio Error:", e);
        return { status: false, error: "Audio download failed" };
    }
}

/**
 * වීඩියෝව (MP4) Download කිරීම සඳහා
 */
async function getVideoFile(url) {
    try {
        const fileName = `temp_vid_${Date.now()}.mp4`;
        const filePath = path.join(__dirname, '..', 'temp', fileName);

        // --recode-video mp4 : වීඩියෝව mp4 වලට හරවයි (Black screen ප්‍රශ්නය වළක්වයි)
        // python3 -m කෑල්ල මෙතනිනුත් අයින් කළා
        const cmd = `yt-dlp "${url}" -f "bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480]/best" --recode-video mp4 -o "${filePath}"`;

        await execPromise(cmd);

        return {
            status: true,
            filePath: filePath
        };
    } catch (e) {
        console.error("YT-DLP Video Error:", e);
        return { status: false, error: "Video download failed" };
    }
}

module.exports = { getAudioFile, getVideoFile };
