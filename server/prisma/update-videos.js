const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();
const INPUT_FILE = path.join(__dirname, 'video-urls.json');

async function updateVideos() {
    console.log('🚀 Starting Database Video Update...');

    if (!fs.existsSync(INPUT_FILE)) {
        console.error(`❌ Error: ${INPUT_FILE} not found. Run collect-videos.js first.`);
        process.exit(1);
    }

    const videoUrls = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));
    if (videoUrls.length === 0) {
        console.error('❌ Error: video-urls.json is empty.');
        process.exit(1);
    }

    console.log(`📦 Loaded ${videoUrls.length} Pexels videos from file.`);

    const posts = await prisma.post.findMany({
        select: { id: true }
    });

    console.log(`📋 Found ${posts.length} existing posts in the database.`);

    if (posts.length === 0) {
        console.log('ℹ️ No posts to update.');
        await prisma.$disconnect();
        return;
    }

    let pexelsIdx = 0;
    let updatedCount = 0;

    for (const post of posts) {
        const pexelsVid = videoUrls[pexelsIdx];

        await prisma.post.update({
            where: { id: post.id },
            data: {
                videoUrl: pexelsVid.url,
                thumbnailUrl: pexelsVid.thumbnail,
                duration: pexelsVid.duration,
                // optionally we could update title here, but it's better to preserve the user's custom titles from seed
                // we'll just update the media assets to real ones.
            }
        });

        updatedCount++;
        pexelsIdx = (pexelsIdx + 1) % videoUrls.length; // Loop around if we have fewer videos than posts

        if (updatedCount % 50 === 0) {
            console.log(`   🔄 Updated ${updatedCount}/${posts.length} posts...`);
        }
    }

    console.log(`\n🎉 Success! Successfully updated ${updatedCount} posts with real Pexels HD videos.`);

    await prisma.$disconnect();
}

updateVideos().catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
});
