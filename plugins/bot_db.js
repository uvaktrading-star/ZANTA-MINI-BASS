const mongoose = require('mongoose');
const config = require('../config');

// 🚨 MongoDB URL එක Secrets හෝ Config වලින් ලබා ගැනීම
const MONGO_URI = process.env.MONGODB_URL || process.env.MONGO_URI || config.MONGODB_URL; 

const SettingsSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true }, // මෙතනට සේව් වෙන්නේ @s.whatsapp.net නැති පිරිසිදු නම්බර් එක පමණි
    botName: { type: String, default: config.DEFAULT_BOT_NAME },
    ownerName: { type: String, default: config.DEFAULT_OWNER_NAME },
    prefix: { type: String, default: config.DEFAULT_PREFIX },
    autoRead: { type: String, default: 'false' },
    autoTyping: { type: String, default: 'false' },
    autoStatusSeen: { type: String, default: 'true' },
    alwaysOnline: { type: String, default: 'false' },
    readCmd: { type: String, default: 'false' },
    autoVoice: { type: String, default: 'false' },
    antiBadword: { type: String, default: 'false' }
});

const Settings = mongoose.models.Settings || mongoose.model('Settings', SettingsSchema);

let isConnected = false;

async function connectDB() {
    if (isConnected) return;
    try {
        await mongoose.connect(MONGO_URI);
        isConnected = true;
        console.log("✅ MongoDB Settings Database Connected!");
    } catch (error) {
        console.error("❌ MongoDB Error:", error);
    }
}

// 🛠️ JID එකෙන් නම්බර් එක විතරක් වෙන් කරගන්නා Function එක
const cleanId = (jid) => jid ? jid.split("@")[0].replace(/[^0-9]/g, "") : null;

async function getBotSettings(userNumber) {
    const defaults = { 
        botName: config.DEFAULT_BOT_NAME, 
        ownerName: config.DEFAULT_OWNER_NAME, 
        prefix: config.DEFAULT_PREFIX,
        autoRead: 'false',
        autoTyping: 'false',
        autoStatusSeen: 'true',
        alwaysOnline: 'false',
        readCmd: 'false',
        autoVoice: 'false',
        antiBadword: 'false'
    };

    const targetId = cleanId(userNumber); // @s.whatsapp.net අයින් කරනවා
    if (!targetId) return defaults;

    try {
        let settings = await Settings.findOne({ id: targetId });
        if (!settings) {
            settings = await Settings.create({ id: targetId, ...defaults });
            console.log(`[DB] Created clean profile for: ${targetId}`);
        }
        return settings.toObject(); 
    } catch (e) {
        console.error('[DB] Fetch Error:', e);
        return defaults;
    }
}

async function updateSetting(userNumber, key, value) {
    const targetId = cleanId(userNumber); // @s.whatsapp.net අයින් කරනවා
    if (!targetId) return false;

    try {
        const result = await Settings.findOneAndUpdate(
            { id: targetId },
            { $set: { [key]: value } },
            { new: true, upsert: true }
        );
        return !!result;
    } catch (e) {
        console.error(`[DB] Update Error (${key}):`, e);
        return false;
    }
}

module.exports = { connectDB, getBotSettings, updateSetting };
