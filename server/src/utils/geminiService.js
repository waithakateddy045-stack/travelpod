/**
 * Gemini AI Service — generates content suggestions for uploads
 * Uses gemini-1.5-flash model via @google/generative-ai
 */

let genAI = null;
let model = null;

try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
        genAI = new GoogleGenerativeAI(apiKey);
        model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        console.log('✨ Gemini AI service initialized');
    } else {
        console.warn('✨ Gemini AI: No GEMINI_API_KEY set — suggestions disabled');
    }
} catch (err) {
    console.warn('✨ Gemini AI: @google/generative-ai not installed — suggestions disabled');
}

/**
 * Generate upload suggestions (titles, description, tags, location, category)
 * @param {object} params - { fileName, fileType, duration }
 * @returns {Promise<object>} suggestions
 */
async function generateSuggestions({ fileName, fileType, duration }) {
    if (!model) {
        return getDefaultSuggestions(fileName);
    }

    try {
        const prompt = `You are a travel content expert for Travelpod, a travel social media platform focused on African and global tourism.

Based on this upload:
- File name: ${fileName}
- File type: ${fileType}
- Duration: ${duration ? duration + ' seconds' : 'image/photo'}

Generate creative suggestions for this travel content post. Return ONLY valid JSON (no markdown, no code blocks) with this exact structure:
{
  "titles": ["catchy title 1", "catchy title 2", "catchy title 3"],
  "description": "engaging 1-2 sentence description",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "location": "best guess location",
  "category": "one of: Destinations, Hotels & Resorts, Restaurants & Food, Adventures & Activities, Travel Tips, Flight Reviews, Safari, Beach, City Life, Culture & History, Nightlife, Wellness"
}

Make titles catchy and travel-themed. Tags should be relevant travel keywords. If the filename hints at a location, use it.`;

        const result = await model.generateContent(prompt);
        const text = result.response.text().trim();
        
        // Try to parse JSON from the response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        
        return getDefaultSuggestions(fileName);
    } catch (err) {
        console.error('Gemini suggestion error:', err.message);
        return getDefaultSuggestions(fileName);
    }
}

/**
 * Generate broadcast text suggestions
 * @param {string} topic - user-provided topic
 * @returns {Promise<object>} { content, hashtags }
 */
async function generateBroadcastContent(topic) {
    if (!model) {
        return {
            content: `📢 ${topic}\n\nStay tuned for more updates from Travelpod!`,
            hashtags: ['#travelpod', '#travel', '#tourism']
        };
    }

    try {
        const prompt = `Write a professional travel industry broadcast post about: "${topic}"

This is for Travelpod, a travel social media platform. The post should be:
- Professional but engaging
- 2-3 paragraphs max
- Include relevant emojis
- Travel/tourism themed

Return ONLY valid JSON (no markdown, no code blocks):
{
  "content": "the broadcast post text",
  "hashtags": ["#hashtag1", "#hashtag2", "#hashtag3"]
}`;

        const result = await model.generateContent(prompt);
        const text = result.response.text().trim();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        return { content: topic, hashtags: ['#travelpod'] };
    } catch (err) {
        console.error('Gemini broadcast error:', err.message);
        return { content: topic, hashtags: ['#travelpod'] };
    }
}

function getDefaultSuggestions(fileName) {
    const clean = (fileName || 'travel-video')
        .replace(/\.[^.]+$/, '')
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());

    return {
        titles: [
            `${clean} — Travel Experience`,
            `Exploring ${clean}`,
            `${clean} Highlights`,
        ],
        description: `Check out this amazing travel experience! ${clean}`,
        tags: ['travel', 'adventure', 'explore', 'wanderlust', 'travelpod'],
        location: '',
        category: 'Destinations',
    };
}

module.exports = { generateSuggestions, generateBroadcastContent };
