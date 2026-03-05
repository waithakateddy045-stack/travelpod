const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();
const INPUT_FILE = path.join(__dirname, 'video-urls.json');

async function seedBoardVideos() {
    console.log('🚀 Starting to populate Trip Boards with Pexels Videos...');

    if (!fs.existsSync(INPUT_FILE)) {
        console.error(`❌ Error: ${INPUT_FILE} not found. Run collect-videos.js first.`);
        process.exit(1);
    }

    const videoUrls = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));
    if (videoUrls.length === 0) {
        console.error('❌ Error: video-urls.json is empty.');
        process.exit(1);
    }

    // 1. Get all existing posts to find out where we left off (how many were already used)
    const existingPostsCount = await prisma.post.count();

    // Safety check - we start using videos from `existingPostsCount` to avoid duplicates
    // However, since we looped in `update-videos.js`, the first N videos were used.
    // If existingPostsCount is 404, we start at index 404.
    let startIndex = existingPostsCount % videoUrls.length;
    let availableVideos = videoUrls.length - startIndex;

    console.log(`📋 Found ${existingPostsCount} existing posts. Starting to use Pexels videos from index ${startIndex}.`);
    console.log(`🎥 Available unused videos: ${availableVideos}`);

    // If for some reason we used them all, just start from 0 again
    if (availableVideos <= 0) {
        startIndex = 0;
        availableVideos = videoUrls.length;
    }

    // 2. Get all Trip Boards
    const boards = await prisma.tripBoard.findMany({
        select: { id: true, userId: true, title: true }
    });

    if (boards.length === 0) {
        console.log('ℹ️ No Trip Boards found. Run seed-boards.js first.');
        await prisma.$disconnect();
        return;
    }

    console.log(`📋 Found ${boards.length} Trip Boards. Getting ready to populate them...`);

    // Let's get the standard category to use for these new posts
    const category = await prisma.category.findFirst({
        where: { name: { contains: 'Travel', mode: 'insensitive' } }
    });

    const categoryId = category ? category.id : (await prisma.category.findFirst())?.id;

    // Distribute remaining videos across boards
    // Let's add up to 20 videos per board (or less depending on total available)
    const targetVideosPerBoard = Math.min(20, Math.floor(availableVideos / boards.length));

    console.log(`🎯 Targeting ~${targetVideosPerBoard} new videos per board.`);

    let currentIndex = startIndex;
    let totalCreated = 0;

    for (const board of boards) {
        console.log(`\n📌 Populating Board: ${board.title}`);

        // Batch create new posts for this board
        let addedToThisBoard = 0;

        // We'll add a few random videos to each board
        const numOfVideos = Math.floor(Math.random() * 10) + targetVideosPerBoard;

        for (let i = 0; i < numOfVideos; i++) {
            if (currentIndex >= videoUrls.length) break; // Reached end of collected videos

            const vid = videoUrls[currentIndex];
            currentIndex++;

            try {
                // Create a new post specifically for this board
                const newPost = await prisma.post.create({
                    data: {
                        userId: board.userId,
                        title: vid.title,
                        description: `Incredible views of ${vid.querySource} by ${vid.author}.`,
                        videoUrl: vid.url,
                        thumbnailUrl: vid.thumbnail,
                        duration: vid.duration,
                        categoryId: categoryId,
                        moderationStatus: 'APPROVED',
                        locationTag: vid.querySource, // Using the query as location
                        postType: 'STANDARD',
                        viewCount: Math.floor(Math.random() * 5000),
                        likeCount: Math.floor(Math.random() * 500),
                    }
                });

                // Attach the new post to the board
                await prisma.tripBoardVideo.create({
                    data: {
                        boardId: board.id,
                        postId: newPost.id
                    }
                });

                addedToThisBoard++;
                totalCreated++;
            } catch (err) {
                console.warn(`  ⚠️ Failed to create post/board-video: ${err.message}`);
            }
        }
        console.log(`  ✅ Added ${addedToThisBoard} videos to this board.`);
    }

    console.log(`\n🎉 Success! Created ${totalCreated} new posts and added them to Trip Boards!`);
    await prisma.$disconnect();
}

seedBoardVideos().catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
});
