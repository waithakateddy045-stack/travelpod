const { PrismaClient } = require('@prisma/client');
const fetch = require('node-fetch'); // or axios, but let's just use https
const https = require('https');

const prisma = new PrismaClient();

async function checkUrl(url) {
    return new Promise((resolve) => {
        if (!url || !url.startsWith('https://')) {
            resolve({ status: 'INVALID', url });
            return;
        }
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({ 
                    status: res.statusCode, 
                    headers: res.headers, 
                    body: data.substring(0, 300), 
                    url 
                });
            });
        }).on('error', (err) => {
            resolve({ status: 'ERROR', message: err.message, url });
        });
    });
}

async function run() {
    console.log('Fetching a few posts from DB...');
    const posts = await prisma.post.findMany({
        where: { videoUrl: { not: null, startsWith: 'https://res.cloudinary.com' } },
        select: { id: true, videoUrl: true, thumbnailUrl: true },
        take: 3,
        orderBy: { createdAt: 'desc' }
    });

    if (!posts.length) {
        console.log('No Cloudinary posts found in DB. Trying Pexels as a baseline...');
        const pexelsPosts = await prisma.post.findMany({
            where: { videoUrl: { not: null } },
            take: 1
        });
        console.log(pexelsPosts);
        return;
    }

    console.log(`Checking ${posts.length} URLs...`);
    for (const post of posts) {
        console.log(`\nPost ID: ${post.id}`);
        console.log(`Video URL: ${post.videoUrl}`);
        const vRes = await checkUrl(post.videoUrl);
        console.log(`Video HTTP Status: ${vRes.status}`);
        if (vRes.status !== 200) console.log(`Body: ${vRes.body}`);

        console.log(`Thumbnail URL: ${post.thumbnailUrl}`);
        const tRes = await checkUrl(post.thumbnailUrl);
        console.log(`Thumbnail HTTP Status: ${tRes.status}`);
        if (tRes.status !== 200) console.log(`Body: ${tRes.body}`);
    }

    prisma.$disconnect();
}

run().catch(console.error);
