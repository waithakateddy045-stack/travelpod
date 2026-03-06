const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const VIDEOS_FILE = path.join(__dirname, 'archive-videos.json');

async function run() {
    if (!fs.existsSync(VIDEOS_FILE)) {
        console.error("No archive-videos.json found. Run crawler first.");
        process.exit(1);
    }

    const archiveVideos = JSON.parse(fs.readFileSync(VIDEOS_FILE, 'utf8'));
    console.log(`Loaded ${archiveVideos.length} videos from archive for board matching.`);

    const boards = await prisma.tripBoard.findMany();
    if (boards.length === 0) {
        console.error("No trip boards found.");
        return;
    }

    console.log("Fetching existing posts to use for boards...");
    const posts = await prisma.post.findMany({
        where: { moderationStatus: 'APPROVED' },
        select: { id: true, title: true, locationTag: true, description: true, videoUrl: true, thumbnailUrl: true }
    });
    console.log(`Found ${posts.length} posts in database.`);

    let totalAdded = 0;

    for (const board of boards) {
        let titleLower = board.title.toLowerCase();
        let destLower = (board.destination || '').toLowerCase();

        let matchedPosts = [];

        for (const p of posts) {
            let text = `${p.title} ${p.locationTag} ${p.description}`.toLowerCase();

            let isMatch = false;
            if (titleLower.includes('kenya') || titleLower.includes('safari') || titleLower.includes('africa')) {
                if (text.includes('kenya') || text.includes('safari') || text.includes('africa') || text.includes('wildlife')) isMatch = true;
            } else if (titleLower.includes('bali') || titleLower.includes('indonesia')) {
                if (text.includes('bali') || text.includes('indonesia') || text.includes('tropical')) isMatch = true;
            } else if (titleLower.includes('europe') || titleLower.includes('paris') || titleLower.includes('london')) {
                if (text.includes('europe') || text.includes('paris') || text.includes('london') || text.includes('amsterdam') || text.includes('italy')) isMatch = true;
            } else if (titleLower.includes('beach') || titleLower.includes('ocean')) {
                if (text.includes('beach') || text.includes('ocean') || text.includes('maldives') || text.includes('resort')) isMatch = true;
            } else {
                if (destLower && text.includes(destLower)) isMatch = true;
            }

            if (isMatch) matchedPosts.push(p);
        }

        // 15-25 videos per board
        let targetCount = Math.floor(Math.random() * 11) + 15;

        if (matchedPosts.length < 10) {
            let shuffled = [...posts].sort(() => 0.5 - Math.random());
            matchedPosts = [...matchedPosts, ...shuffled.slice(0, 15)];
            matchedPosts = Array.from(new Set(matchedPosts.map(p => p.id)))
                .map(id => matchedPosts.find(p => p.id === id));
        }

        matchedPosts = matchedPosts.slice(0, targetCount);

        if (matchedPosts.length > 0) {
            for (let i = 0; i < matchedPosts.length; i++) {
                try {
                    await prisma.tripBoardVideo.upsert({
                        where: {
                            boardId_postId: {
                                boardId: board.id,
                                postId: matchedPosts[i].id
                            }
                        },
                        update: {},
                        create: {
                            boardId: board.id,
                            postId: matchedPosts[i].id,
                            sortOrder: i
                        }
                    });
                } catch (e) { }
            }

            await prisma.tripBoard.update({
                where: { id: board.id },
                data: {
                    coverImage: matchedPosts[0].thumbnailUrl,
                    videoCount: matchedPosts.length
                }
            });

            totalAdded += matchedPosts.length;
            console.log(`Populating board: ${board.title} — added ${matchedPosts.length} videos`);
        }
    }

    console.log(`\n✅ Populated ${boards.length} boards with videos.`);
}
run().catch(console.error).finally(() => prisma.$disconnect());
