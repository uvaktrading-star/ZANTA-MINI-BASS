const { cmd } = require('../command');
const axios = require('axios');

cmd({
    pattern: "ai",
    alias: ["ultra", "ask", "groq"],
    react: "⚡",
    desc: "Smart Custom Personality AI",
    category: "tools",
    use: ".ai hi",
    filename: __filename
},
async (zanta, mek, m, { q, reply }) => {
    try {
        if (!q) return reply("❌ කරුණාකර ප්‍රශ්නයක් ලබා දෙන්න.");

        // 🔑 ඔයාගේ API Keys ටික මෙතනට දාන්න
        const keys = [
            "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", 
            "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",
            "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",
            "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",
            "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"
        ];

        let success = false;
        let aiResponse = "";

        for (let key of keys) {
            try {
                const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
                    model: "llama-3.3-70b-versatile",
                    messages: [
                        { 
                            role: "system", 
                            content: "My name is Zanta-md." 
                        },
                        // --- මෙන්න මූව පුහුණු කරන තැන (Examples) ---
                        { role: "user", content: "Hi" },
                        { role: "assistant", content: "Hey..Ima zanta-md AI Assistent.How can i help you" },
                       
                        // ------------------------------------------
                        { role: "user", content: q }
                    ],
                    temperature: 0.6, // 0.8 ට වඩා 0.6 හොඳයි සිංහල වචන හරියට එන්න
                    max_tokens: 1500
                }, {
                    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
                    timeout: 10000
                });

                if (response.data?.choices?.[0]?.message?.content) {
                    aiResponse = response.data.choices[0].message.content;
                    success = true;
                    break;
                }
            } catch (e) {
                console.log(`Key Failed: ${e.message}`);
                continue; 
            }
        }

        if (success) {
            await reply(aiResponse);
        } else {
            return reply("⚠️ Keys Limit! පොඩ්ඩක් ඉඳලා බලමු.");
        }

    } catch (e) {
        return reply("⚠️ Error එකක් වුණා මචං.");
    }
});
