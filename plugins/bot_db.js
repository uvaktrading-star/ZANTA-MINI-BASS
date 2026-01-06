const mongoose = require('mongoose');
const config = require('../config');

const MONGO_URI = process.env.MONGODB_URL || process.env.MONGO_URI || config.MONGODB_URL; 

const SettingsSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    botName: { type: String, default: config.DEFAULT_BOT_NAME },
    ownerName: { type: String, default: config.DEFAULT_OWNER_NAME },
    prefix: { type: String, default: config.DEFAULT_PREFIX },
    password: { type: String, default: 'not_set' }, // new feature
    autoRead: { type: String, default: 'false' },
    autoTyping: { type: String, default: 'false' },
    autoStatusSeen: { type: String, default: 'true' },
    alwaysOnline: { type: String, default: 'false' },
    readCmd: { type: String, default: 'false' },
    autoVoice: { type: String, default: 'false' },
    autoStatusReact: { type: String, default: 'false' },
});

const Settings = mongoose.models.Settings || mongoose.model('Settings', SettingsSchema);

// --- [MEMORY CACHE] ---
const settingsCache = new Map();
const CACHE_TTL = 10 * 60 * 1000; 

async function connectDB() {
    if (mongoose.connection.readyState === 1) return;
    try {
        await mongoose.connect(MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            maxPoolSize: 5 
        });
        console.log("✅ MongoDB Connected!");
    } catch (error) {
        console.error("❌ MongoDB Connection Error:", error);
    }
}

const cleanId = (jid) => jid ? jid.split("@")[0].replace(/[^0-9]/g, "") : null;

async function getBotSettings(userNumber) {
    const targetId = cleanId(userNumber);
    if (!targetId) return null;

    if (settingsCache.has(targetId)) {
        return settingsCache.get(targetId);
    }

    try {
        let settings = await Settings.findOne({ id: targetId }).lean(); 
        
        if (!settings) {
            settings = await Settings.create({ id: targetId });
            settings = settings.toObject();
        }

        settingsCache.set(targetId, settings);
        setTimeout(() => settingsCache.delete(targetId), CACHE_TTL); 

        return settings;
    } catch (e) {
        console.error("❌ Error fetching settings:", e);
        return null;
    }
}

async function updateSetting(userNumber, key, value) {
    try {
        const targetId = cleanId(userNumber);
        const result = await Settings.findOneAndUpdate(
            { id: targetId },
            { $set: { [key]: value } },
            { new: true, upsert: true, lean: true }
        );

        if (result) {
            settingsCache.set(targetId, result);
        }
        return !!result;
    } catch (e) {
        console.error("❌ Error updating setting:", e);
        return false;
    }
}

module.exports = { connectDB, getBotSettings, updateSetting };
