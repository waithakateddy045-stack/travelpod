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

    const videos = JSON.parse(fs.readFileSync(VIDEOS_FILE, 'utf8'));
    console.log(`Loaded ${videos.length} videos from archive.`);

    const users = await prisma.user.findMany({
        where: { accountType: { not: 'ADMIN' } },
        include: { profile: true }
    });

    if (users.length === 0) {
        console.error("No users found to distribute posts to.");
        return;
    }

    const categoriesDb = await prisma.category.findMany();
    const categoriesMap = {};
    categoriesDb.forEach(c => categoriesMap[c.name.toLowerCase()] = c.id);

    let createdCount = 0;
    videos.sort(() => 0.5 - Math.random());
    let videoIndex = 0;

    for (const user of users) {
        let countForUser = Math.floor(Math.random() * 6) + 10; // 10 to 15 posts
        let userVideosAssigned = 0;

        const isTraveler = user.accountType === 'TRAVELER';
        const isAgency = user.accountType === 'TRAVEL_AGENCY';
        const isResort = user.accountType === 'HOTEL_RESORT';
        const isAirline = user.accountType === 'AIRLINE';
        const isDest = user.accountType === 'DESTINATION';

        while (userVideosAssigned < countForUser) {
            if (videos.length === 0) break;

            // Just grab the next video in the array, wrapping around if needed
            let v = videos[videoIndex % videos.length];
            videoIndex++;

            let categoryId = categoriesMap[v.category.toLowerCase()];
            if (!categoryId) categoryId = categoriesMap['travel'] || categoriesDb[0].id;

            try {
                const tagConnections = [];
                const seenTags = new Set();
                for (const t of v.tags.slice(0, 5)) {
                    const tagStr = t.trim().substring(0, 30);
                    if (!tagStr || seenTags.has(tagStr)) continue;
                    seenTags.add(tagStr);
                    let tagDb = await prisma.tag.findUnique({ where: { name: tagStr } });
                    if (!tagDb) tagDb = await prisma.tag.create({ data: { name: tagStr } });
                    tagConnections.push({ tagId: tagDb.id });
                }

                await prisma.post.create({
                    data: {
                        userId: user.id,
                        videoUrl: v.url,
                        thumbnailUrl: v.thumbnailUrl,
                        title: v.title.substring(0, 100),
                        description: v.description ? v.description.substring(0, 300) : null,
                        locationTag: v.location ? v.location.substring(0, 200) : null,
                        moderationStatus: 'APPROVED',
                        duration: v.duration,
                        categoryId,
                        postTags: { create: tagConnections }
                    }
                });
                createdCount++;
                userVideosAssigned++;
                if (createdCount % 50 === 0) {
                    console.log(`Creating post ${createdCount}... (Assigned to @${user.profile.handle})`);
                }
            } catch (err) {
                console.error("Failed creating post:", err.message);
            }
        }
    }

    console.log(`\n✅ Created ${createdCount} posts across ${users.length} users.`);
}
run().catch(console.error).finally(() => prisma.$disconnect());
