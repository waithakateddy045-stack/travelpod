const axios = require('axios');

const API_URL = 'http://localhost:5000/api';
// We need a way to authenticate as a user if needed, but these endpoints might be public or support guest access.
// Let's try guest access first.

async function testEndpoints() {
    try {
        console.log('--- Testing /boards/feed ---');
        const boardsRes = await axios.get(`${API_URL}/boards/feed?page=1&limit=10`);
        console.log('Boards Success:', boardsRes.data.success);
        console.log('Boards Count:', boardsRes.data.boards?.length);
        if (boardsRes.data.boards?.length > 0) {
            console.log('First Board Title:', boardsRes.data.boards[0].title);
        }

        console.log('\n--- Testing /broadcasts/explore ---');
        const broadcastsRes = await axios.get(`${API_URL}/broadcasts/explore?page=1&limit=10`);
        console.log('Broadcasts Success:', broadcastsRes.data.success);
        console.log('Broadcasts Count:', broadcastsRes.data.broadcasts?.length);
    } catch (err) {
        console.error('API Error:', err.response?.data || err.message);
    }
}

testEndpoints();
