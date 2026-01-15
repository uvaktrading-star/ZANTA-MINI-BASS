const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function getAudioFile(url) {
    const fileName = `temp_${Date.now()}.mp3`;
    const tempDir = path.join(__dirname, '..', 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    const filePath = path.join(tempDir, fileName);

    try {
        // ඔයාගේ Vercel URL එක මෙතනට දාන්න
        const vercel_url = `https://zanta-ytdl.vercel.app/api/yt?url=${encodeURIComponent(url)}&type=mp3`;
        const res = await axios.get(vercel_url);
        
        if (res.data && res.data.dl_url) {
            const response = await axios({ url: res.data.dl_url, method: 'GET', responseType: 'stream' });
            const writer = fs.createWriteStream(filePath);
            response.data.pipe(writer);

            return new Promise((resolve) => {
                writer.on('finish', () => resolve({ status: true, filePath: filePath }));
                writer.on('error', () => resolve({ status: false }));
            });
        }
    } catch (e) {
        console.error("Vercel API Error:", e.message);
        return { status: false };
    }
}

module.exports = { getAudioFile };
