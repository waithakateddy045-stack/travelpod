const { GoogleGenerativeAI } = require('@google/generative-ai');

let genAI = null;
let model = null;

try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
        genAI = new GoogleGenerativeAI(apiKey);
        model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    }
} catch (err) {
    console.warn('Gemini AI not specialized for chat');
}

// In-memory store for chat history (in a real app, this should be in Redis or DB)
const chatMemory = new Map();

const chatWithCopilot = async (req, res, next) => {
    try {
        const { message, sessionId = 'default-session' } = req.body;
        if (!message) return res.status(400).json({ error: 'Message is required' });

        if (!model) {
            return res.json({
                success: true,
                reply: "I'm currently offline running some updates, but I'll be back soon to help you with your travel plans!"
            });
        }

        // Retrieve or initialize history
        let history = chatMemory.get(sessionId);
        if (!history) {
            history = [
                {
                    role: 'user',
                    parts: [{
                        text: `You are the Travelpod AI Copilot. You are a highly intelligent, sturdy, and professional travel assistant built specifically for Travelpod—a video-first travel platform linking African and global tourism. 
                    Be highly critical but helpful. Act like an authoritative travel expert and content creation guru. You assist travelers with finding destinations, and businesses with writing compelling posts and broadcasts. Keep your responses concise and well-formatted. Do not use markdown blocks unless specifically asked for code.` }]
                },
                {
                    role: 'model',
                    parts: [{ text: "Understood. I am the Travelpod AI Copilot, ready to assist travelers and travel businesses with expert, critical, and concise guidance." }]
                }
            ];
        }

        // Ensure history length doesn't exceed Gemini limits or memory limits
        if (history.length > 20) {
            history = [history[0], history[1], ...history.slice(-10)];
        }

        const chat = model.startChat({ history });

        const result = await chat.sendMessage(message);
        const reply = result.response.text();

        // Save back to memory
        history.push({ role: 'user', parts: [{ text: message }] });
        history.push({ role: 'model', parts: [{ text: reply }] });
        chatMemory.set(sessionId, history);

        res.json({ success: true, reply });
    } catch (err) {
        console.error('❌ Copilot Chat Error:', err);
        res.status(500).json({ error: 'Copilot encountered an error analyzing your request.', details: err.message });
    }
};

const clearChatHistory = async (req, res, next) => {
    try {
        const { sessionId = 'default-session' } = req.body;
        chatMemory.delete(sessionId);
        res.json({ success: true, message: 'Memory cleared.' });
    } catch (err) {
        next(err);
    }
};

const generatePostDetails = async (req, res, next) => {
    try {
        const { type, context } = req.body;
        if (!model) return res.status(503).json({ error: 'AI Service Unavailable' });

        const prompt = `Generate travel post details for a ${type} post. 
        Context: ${context || 'Travel experience'}
        Return JSON format: { "title": "...", "description": "...", "tags": ["tag1", "tag2"], "category": "..." }
        Keep it professional and inspiring. Limit title to 50 chars and description to 200 chars.`;

        const result = await model.generateContent(prompt);
        const text = result.response.text();

        // Extract JSON from potential markdown blocks
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const data = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

        res.json({ success: true, data });
    } catch (err) {
        console.error('❌ AI Detail Gen Error:', err);
        res.status(500).json({ error: 'Failed to generate details', details: err.message });
    }
};

module.exports = { chatWithCopilot, clearChatHistory, generatePostDetails };
