const { GoogleGenerativeAI } = require('@google/generative-ai');

const getAISuggestions = async ({ fileName, fileType, duration }) => {
    try {
        if (!process.env.GEMINI_API_KEY) throw new Error('No key');
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const prompt = `You are a travel content assistant. Generate suggestions for a travel post. File: ${fileName}, Type: ${fileType}, Duration: ${duration}s. Return ONLY valid JSON with: titles (array of 3 short catchy travel titles), description (2 sentences), tags (array of 5 travel tags), location (guess from filename or leave empty string), category (one of: Adventure/Safari/Beach/City/Culture/Food/Nature/Luxury)`;
        const result = await model.generateContent(prompt);
        const text = result.response.text().replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(text);
        return { ...parsed, fallback: false };
    } catch (err) {
        return {
            titles: ['Travel Adventure', 'Explore the World', 'Journey Begins'],
            description: 'An amazing travel experience worth sharing.',
            tags: ['travel', 'adventure', 'explore', 'wanderlust', 'journey'],
            location: '',
            category: 'Adventure',
            fallback: true
        };
    }
};

module.exports = { getAISuggestions };
