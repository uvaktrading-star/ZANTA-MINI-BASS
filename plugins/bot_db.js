const mongoose = require('mongoose');
const config = require('../config');

const MONGO_URI = process.env.MONGODB_URL || process.env.MONGO_URI || config.MONGODB_URL; 

const SettingsSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    botName: { type: String, default: config.DEFAULT_BOT_NAME },
    ownerName: { type: String, default: config.DEFAULT_OWNER_NAME },
    prefix: { type: String, default: config.DEFAULT_PREFIX },
    password: { type: String, default: 'not_set' },
    alwaysOnline: { type: String, default: 'false' },
    autoRead: { type: String, default: 'false' },
    autoTyping: { type: String, default: 'false' },
    autoStatusSeen: { type: String, default: 'true' },
    autoStatusReact: { type: String, default: 'false' },
    readCmd: { type: String, default: 'false' },
    autoVoice: { type: String, default: 'false' },
    autoReply: { type: String, default: 'false' } 
});

const AutoReplySchema = new mongoose.Schema({
    userId: { type: String, required: true }, 
    trigger: { type: String, required: true, lowercase: true }, 
    chat_reply: { type: String, required: true } 
});

const Settings = mongoose.models.Settings || mongoose.model('Settings', SettingsSchema);
const AutoReply = mongoose.models.AutoReply || mongoose.model('AutoReply', AutoReplySchema);

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

    // Cache එකේ තියෙනවා නම් ඒක දෙනවා (හැබැයි අපි /update-cache එකේදී මේක delete කරනවා)
    if (settingsCache.has(targetId)) {
        return settingsCache.get(targetId);
    }

    try {
        let settings = await Settings.findOne({ id: targetId }).lean(); 
        
        if (!settings) {
            settings = await Settings.create({ id: targetId });
            settings = settings.toObject ? settings.toObject() : settings;
        }

        // ✅ වැදගත්ම කොටස: Auto Replies ටිකත් අරගෙන settings object එකටම දානවා
        // එතකොට index.js එකේ userSettings.autoReplies ලෙස කෙලින්ම පාවිච්චි කළ හැක.
        const replies = await AutoReply.find({ userId: targetId }).lean();
        settings.autoReplies = replies.map(r => ({ keyword: r.trigger, reply: r.chat_reply }));

        settingsCache.set(targetId, settings);
        setTimeout(() => settingsCache.delete(targetId), CACHE_TTL); 

        return settings;
    } catch (e) {
        console.error("❌ Error fetching settings:", e);
        return null;
    }
}

async function updateSetting(userNumber, keyOrObject, value = null) {
    try {
        const targetId = cleanId(userNumber);
        let updateData = {};

        if (typeof keyOrObject === 'object') {
            updateData = keyOrObject;
        } else {
            updateData = { [keyOrObject]: value };
        }

        const result = await Settings.findOneAndUpdate(
            { id: targetId },
            { $set: updateData },
            { new: true, upsert: true, lean: true }
        );

        // Update වුණාම Cache එක clear කරනවා අලුත්ම දත්ත ලැබෙන්න
        settingsCache.delete(targetId);
        
        return !!result;
    } catch (e) {
        console.error("❌ Error updating setting:", e);
        return false;
    }
}

// ✅ මේක index.js එකේ පාවිච්චි කරන්න පුළුවන් Helper එකක්
async function getAutoReply(userNumber, text) {
    const targetId = cleanId(userNumber);
    const settings = await getBotSettings(targetId);
    if (!settings || settings.autoReply !== 'true' || !settings.autoReplies) return null;

    const found = settings.autoReplies.find(r => r.keyword.toLowerCase().trim() === text.toLowerCase().trim());
    return found ? found.reply : null;
}

module.exports = { connectDB, getBotSettings, updateSetting, getAutoReply, AutoReply, Settings };
