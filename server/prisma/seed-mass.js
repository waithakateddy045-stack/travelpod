const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const OFFICIAL_ACCOUNT_ID = 'cmmkq6gr100019q44pmqevmo6'; // official_travelpod

const ACCOUNT_TYPES = ['TRAVELER', 'TRAVEL_AGENCY', 'HOTEL_RESORT', 'DESTINATION', 'AIRLINE', 'ASSOCIATION'];
const LOCATIONS = ['Lagos, Nigeria', 'Nairobi, Kenya', 'Cape Town, South Africa', 'Cairo, Egypt', 'Marrakech, Morocco', 'Tokyo, Japan', 'Paris, France', 'New York, USA', 'Bali, Indonesia', 'Sydney, Australia'];
const TAGS_POOL = ['adventure', 'luxury', 'budget', 'culture', 'food', 'nature', 'city', 'hidden-gem', 'photography'];

const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

async function seedMass() {
    console.log('🚀 Resuming/Starting Mass Seeding...');
    const password = await bcrypt.hash('Travel1234', 12);

    // 1. Ensure 100 Diverse Accounts exist
    console.log('👤 Checking/Creating 100 accounts...');
    let existingNewUsers = await prisma.user.findMany({
        where: { email: { contains: 'travelpod.test' } }
    });

    if (existingNewUsers.length < 100) {
        const needed = 100 - existingNewUsers.length;
        for (let i = 0; i < needed; i++) {
            const username = `traveler_seed_${Date.now()}_${Math.random().toString(36).substring(7)}`;
            const user = await prisma.user.create({
                data: {
                    email: `${username}@travelpod.test`,
                    username: username,
                    displayName: `Global Explorer ${existingNewUsers.length + i + 1}`,
                    password: password,
                    accountType: rand(ACCOUNT_TYPES),
                    isVerified: Math.random() > 0.7,
                    onboardingComplete: true,
                    followerCount: randInt(10, 500),
                    followingCount: randInt(5, 100),
                    personalityTags: [rand(TAGS_POOL), rand(TAGS_POOL)],
                }
            });
            existingNewUsers.push(user);

            await prisma.follow.create({
                data: { followerId: user.id, followingId: OFFICIAL_ACCOUNT_ID }
            }).catch(() => { });
        }
    }
    console.log(`✅ ${existingNewUsers.length} seed users ready.`);

    // 2. Posts: Check current count
    const postCount = await prisma.post.count();
    console.log(`📊 Current total posts: ${postCount}`);

    if (postCount < 1700) {
        console.log('🎬 Adding more media posts to hit target...');
        const archiveVideos = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'archive-videos.json'), 'utf8'));
        const needed = 1800 - postCount;

        // Randomly pick unique videos from the pool
        let created = 0;
        for (let i = 0; i < needed && i < archiveVideos.length; i++) {
            const video = rand(archiveVideos); // Random pick for variety
            const user = rand(existingNewUsers);
            await prisma.post.create({
                data: {
                    userId: user.id,
                    videoUrl: video.url,
                    thumbnailUrl: video.thumbnailUrl || video.url.replace('.mp4', '.jpg'),
                    title: video.title,
                    description: video.description || 'Amazing discovery!',
                    duration: video.duration || 60,
                    category: video.category || 'Travel',
                    tags: video.tags || ['travel'],
                    postType: 'VIDEO',
                    moderationStatus: 'APPROVED',
                    viewCount: randInt(100, 2000),
                    likeCount: randInt(10, 200)
                }
            }).catch(() => { }); // handle duplicate if random pick hits same title/id

            created++;
            if (created % 100 === 0) console.log(`   📹 Created ${created} additional posts...`);
        }
    }

    // 3. Create 40 Destination boards
    console.log('📋 Creating 40 trip boards...');
    const destinations = ['Bali Retreat', 'Kenya Safari', 'Paris Romance', 'Tokyo Tech', 'Alpine Ski', 'Amazon Wild', 'Sahara Trek', 'Icelandic Ice', 'Greek Island', 'Maya Ruins'];
    const videoPosts = await prisma.post.findMany({
        where: { postType: 'VIDEO' },
        take: 1500,
        select: { id: true, title: true }
    });

    for (let i = 0; i < 40; i++) {
        const user = rand(existingNewUsers);
        const dest = rand(destinations);
        const board = await prisma.tripBoard.create({
            data: {
                userId: user.id,
                title: `${dest} Collection #${i + 1}`,
                description: `A collection of the best spots and experiences in ${dest}.`,
                destination: dest,
                isPublic: true,
                coverImage: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e'
            }
        });

        // Link 8-15 videos to each board
        const selected = videoPosts.sort(() => 0.5 - Math.random()).slice(0, randInt(8, 15));
        for (const v of selected) {
            await prisma.tripBoardVideo.create({
                data: {
                    boardId: board.id,
                    postId: v.id
                }
            }).catch(() => { });
        }
    }
    console.log('✅ 40 trip boards created with videos.');

    const finalCount = await prisma.post.count();
    const boardCount = await prisma.tripBoard.count();
    console.log(`✨ SEED COMPLETE! Total Posts: ${finalCount}, Total Boards: ${boardCount}`);
}

seedMass()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
