const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function getAudioFile(url) {
    const fileName = `temp_${Date.now()}.mp3`;
    const tempDir = path.join(__dirname, '..', 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    const filePath = path.join(tempDir, fileName);

    try {
        console.log("📡 Connecting to Cobalt API for:", url);

        // Cobalt API එකට Request එක යවනවා
        const res = await axios.post('https://api.cobalt.tools/api/json', {
            url: url,
            downloadMode: 'audio',
            audioFormat: 'mp3',
            filenamePattern: 'basic'
        }, {
            headers: {
                'accept': 'application/json',
                'content-type': 'application/json'
            }
        });

        if (res.data && res.data.url) {
            console.log("📥 API Success! Downloading file to VPS...");
            
            const response = await axios({
                url: res.data.url,
                method: 'GET',
                responseType: 'stream'
            });

            const writer = fs.createWriteStream(filePath);
            response.data.pipe(writer);

            return new Promise((resolve, reject) => {
                writer.on('finish', () => {
                    if (fs.existsSync(filePath) && fs.statSync(filePath).size > 100) {
                        console.log("✅ Audio Downloaded Successfully!");
                        resolve({ status: true, filePath: filePath });
                    } else {
                        resolve({ status: false, error: "Empty file from API" });
                    }
                });
                writer.on('error', reject);
            });
        } else {
            throw new Error("API did not return a download URL");
        }

    } catch (e) {
        console.error("❌ Cobalt API Error:", e.message);
        // මෙතනදී Fallback එකක් විදිහට තව එක API එකක් බලනවා
        try {
            console.log("🔄 Trying Backup API...");
            const res2 = await axios.get(`https://api.vreden.my.id/api/ytdl?url=${encodeURIComponent(url)}`);
            const dlUrl = res2.data?.result?.mp3 || res2.data?.result?.downloadUrl;
            
            if (dlUrl) {
                const response = await axios({ url: dlUrl, method: 'GET', responseType: 'stream' });
                const writer = fs.createWriteStream(filePath);
                response.data.pipe(writer);
                return new Promise((resolve) => {
                    writer.on('finish', () => resolve({ status: true, filePath: filePath }));
                    writer.on('error', () => resolve({ status: false }));
                });
            }
        } catch (err) {
            return { status: false, error: "All APIs failed." };
        }
        return { status: false, error: e.message };
    }
}

async function getVideoFile(url) {
    const fileName = `temp_vid_${Date.now()}.mp4`;
    const tempDir = path.join(__dirname, '..', 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    const filePath = path.join(tempDir, fileName);

    try {
        const res = await axios.post('https://api.cobalt.tools/api/json', {
            url: url,
            downloadMode: 'video',
            videoQuality: '720',
            filenamePattern: 'basic'
        }, {
            headers: { 'accept': 'application/json', 'content-type': 'application/json' }
        });

        if (res.data && res.data.url) {
            const response = await axios({ url: res.data.url, method: 'GET', responseType: 'stream' });
            const writer = fs.createWriteStream(filePath);
            response.data.pipe(writer);
            return new Promise((resolve) => {
                writer.on('finish', () => resolve({ status: true, filePath: filePath }));
                writer.on('error', () => resolve({ status: false }));
            });
        }
    } catch (e) {
        return { status: false };
    }
}

module.exports = { getAudioFile, getVideoFile };
