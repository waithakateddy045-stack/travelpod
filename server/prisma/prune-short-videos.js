const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();
const INPUT_FILE = path.join(__dirname, 'video-urls.json');

async function pruneShortVideos() {
    console.log('🚀 Checking database for videos under 30 seconds...');

    if (!fs.existsSync(INPUT_FILE)) {
        console.error(`❌ Error: ${INPUT_FILE} not found.`);
        process.exit(1);
    }

    const videoUrls = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));
    const longVideos = videoUrls.filter(v => v.duration >= 30);

    if (longVideos.length === 0) {
        console.error('❌ Error: No videos >= 30s found in collection.');
        process.exit(1);
    }
    console.log(`🎥 Found ${longVideos.length} videos >= 30s in collection to use as replacements.`);

    const shortPosts = await prisma.post.findMany({
        where: { duration: { lt: 30 } },
        select: { id: true }
    });

    console.log(`📋 Found ${shortPosts.length} posts in database under 30 seconds.`);

    if (shortPosts.length === 0) {
        console.log('✅ All database posts are already 30s or longer!');
        await prisma.$disconnect();
        return;
    }

    let pexelsIdx = 0;
    let updatedCount = 0;

    for (const post of shortPosts) {
        const replacement = longVideos[pexelsIdx];

        await prisma.post.update({
            where: { id: post.id },
            data: {
                videoUrl: replacement.url,
                thumbnailUrl: replacement.thumbnail,
                duration: replacement.duration,
                title: replacement.title,
                description: `Incredible views of ${replacement.querySource} by ${replacement.author}.`
            }
        });

        updatedCount++;
        pexelsIdx = (pexelsIdx + 1) % longVideos.length;

        if (updatedCount % 50 === 0) {
            console.log(`   🔄 Updated ${updatedCount}/${shortPosts.length} posts...`);
        }
    }

    console.log(`\n🎉 Success! Enforced minimum 30-second video length. Updated ${updatedCount} posts.`);
    await prisma.$disconnect();
}

pruneShortVideos().catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
});
