const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') }); // It's in root directory! Wait, __dirname is server. ROOT is sidereal-planck/.env? Let's check.
const pool = require('./src/utils/cloudinaryPool');

async function test() {
    try {
        console.log('Env cloud name:', process.env.CLOUDINARY_CLOUD_NAME);
        console.log('Testing image upload...');
        const result = await pool.uploadImage('./avatar.png', 'travelpod/avatars');
        console.log('Success:', result);
    } catch (e) {
        console.error('Failed:', e);
    }
}

test();
