/**
 * Travelpod Seed Script - FIXED
 * Creates 1 admin + 40 users + 400 travel video posts with real playable videos from Archive.org
 */
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();
const SALT_ROUNDS = 12;

// ============================================================
// Helper Functions
// ============================================================
const randomFrom = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomDate = (daysAgo) => {
    const d = new Date();
    d.setDate(d.getDate() - Math.random() * daysAgo);
    return d;
};

// ============================================================
// Real playable travel video URLs from Archive.org
// ============================================================
const archiveVideos = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'archive-videos.json'), 'utf8'));
const VIDEO_POOL = archiveVideos.slice(0, 1000);

const getThumbnail = (videoObj) => {
    return videoObj.thumbnailUrl || videoObj.url.replace('.mp4', '.jpg');
};

// ============================================================
// Seed data arrays
// ============================================================
const ACCOUNT_TYPES = ['TRAVELER', 'TRAVEL_AGENCY', 'HOTEL_RESORT', 'DESTINATION', 'AIRLINE', 'ASSOCIATION'];

const LOCATIONS = [
    'Bali, Indonesia', 'Santorini, Greece', 'Machu Picchu, Peru', 'Maldives',
    'Paris, France', 'Tokyo, Japan', 'Serengeti, Tanzania', 'Dubai, UAE',
    'Bora Bora, French Polynesia', 'Kyoto, Japan', 'Cape Town, South Africa',
    'Barcelona, Spain', 'Banff, Canada', 'Zanzibar, Tanzania', 'Amalfi Coast, Italy',
    'Queenstown, New Zealand', 'Petra, Jordan', 'Iceland', 'Marrakech, Morocco',
    'Swiss Alps, Switzerland', 'Halong Bay, Vietnam', 'Yosemite, USA',
    'Great Barrier Reef, Australia', 'Sahara Desert, Morocco', 'Tulum, Mexico',
    'Dubrovnik, Croatia', 'Rio de Janeiro, Brazil', 'Patagonia, Argentina',
    'Seychelles', 'Lofoten Islands, Norway', 'Maasai Mara, Kenya',
    'Angkor Wat, Cambodia', 'Phuket, Thailand', 'Lake Como, Italy',
    'Galápagos Islands, Ecuador', 'Turks and Caicos', 'Zanzibar, Tanzania',
    'Cappadocia, Turkey', 'Fiji Islands', 'Iguazu Falls, Brazil',
];

const TAGS_POOL = [
    'travel', 'wanderlust', 'explore', 'adventure', 'nature', 'sunset',
    'beach', 'mountain', 'ocean', 'luxury', 'backpacking', 'roadtrip',
    'foodie', 'culture', 'photography', 'drone', 'safari', 'island',
    'diving', 'hiking', 'camping', 'wildlife', 'cityscape', 'heritage',
    'tropical', 'snow', 'desert', 'waterfalls', 'cruise', 'honeymoon',
    'family', 'solo', 'budgettravel', 'wellness', 'spa',
    'nightlife', 'festival', 'market', 'temple', 'palace', 'volcano',
];

const USER_PROFILES = [
    // Travelers (15)
    { accountType: 'TRAVELER', displayName: 'Alex Wanderer', handle: 'alexwanderer', tags: ['Adventure', 'Solo Travel'] },
    { accountType: 'TRAVELER', displayName: 'Maya Horizons', handle: 'mayahorizons', tags: ['Beach', 'Luxury'] },
    { accountType: 'TRAVELER', displayName: 'Ravi Explorer', handle: 'raviexplorer', tags: ['Culture', 'Food'] },
    { accountType: 'TRAVELER', displayName: 'Sofia Trails', handle: 'sofiatrails', tags: ['Hiking', 'Nature'] },
    { accountType: 'TRAVELER', displayName: 'Jordan Nomad', handle: 'jordannomad', tags: ['Backpacking', 'Budget'] },
    { accountType: 'TRAVELER', displayName: 'Amina Globe', handle: 'aminaglobe', tags: ['Culture', 'Heritage'] },
    { accountType: 'TRAVELER', displayName: 'Luca Voyage', handle: 'lucavoyage', tags: ['Photography', 'Drone'] },
    { accountType: 'TRAVELER', displayName: 'Chloe Coastal', handle: 'chloecoastal', tags: ['Beach', 'Diving'] },
    { accountType: 'TRAVELER', displayName: 'Omar Peaks', handle: 'omarpeaks', tags: ['Mountain', 'Snow'] },
    { accountType: 'TRAVELER', displayName: 'Yuki Passport', handle: 'yukipassport', tags: ['City', 'Food'] },
    { accountType: 'TRAVELER', displayName: 'Nia Sunsets', handle: 'niasunsets', tags: ['Sunset', 'Island'] },
    { accountType: 'TRAVELER', displayName: 'Marco Adventure', handle: 'marcoadventure', tags: ['Extreme', 'Camping'] },
    { accountType: 'TRAVELER', displayName: 'Elena Waves', handle: 'elenawaves', tags: ['Surfing', 'Ocean'] },
    { accountType: 'TRAVELER', displayName: 'Kai Roadtrip', handle: 'kairoadtrip', tags: ['Road Trip', 'Van Life'] },
    { accountType: 'TRAVELER', displayName: 'Zara Wander', handle: 'zarawander', tags: ['Solo', 'Wellness'] },
    // travel agencies etc to reach 40 users
    { accountType: 'TRAVEL_AGENCY', displayName: 'Horizon Travel Co.', handle: 'horizontravel', tags: ['Packages', 'Guided Tours'] },
    { accountType: 'TRAVEL_AGENCY', displayName: 'Safari Dreams Agency', handle: 'safaridreams', tags: ['Safari', 'Wildlife'] },
    { accountType: 'HOTEL_RESORT', displayName: 'Oceanview Resort & Spa', handle: 'oceanviewresort', tags: ['Beachfront', 'Spa'] },
    { accountType: 'HOTEL_RESORT', displayName: 'Alpine Grand Hotel', handle: 'alpinegrand', tags: ['Ski', 'Mountain'] },
    { accountType: 'DESTINATION', displayName: 'Visit Bali Official', handle: 'visitbali', tags: ['Bali', 'Indonesia'] },
    { accountType: 'DESTINATION', displayName: 'Discover Santorini', handle: 'discoversantorini', tags: ['Greece', 'Islands'] },
    { accountType: 'AIRLINE', displayName: 'SkyWing Airlines', handle: 'skywingair', tags: ['Flying', 'Premium'] },
    { accountType: 'ASSOCIATION', displayName: 'World Travel Association', handle: 'worldtravelassoc', tags: ['Industry', 'Standards'] },
];

const generateAvatar = (handle) =>
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${handle}`;

// ============================================================
// MAIN SEED FUNCTION
// ============================================================
async function main() {
    console.log('🌍 Travelpod Seeder — Starting...\n');

    // 1. Clear existing data
    console.log('🧹 Clearing existing data...');
    try {
        await prisma.conversationParticipant.deleteMany();
        await prisma.message.deleteMany();
        await prisma.conversation.deleteMany();
        await prisma.bookingEnquiry.deleteMany();
        await prisma.boardComment.deleteMany();
        await prisma.boardFollow.deleteMany();
        await prisma.boardSave.deleteMany();
        await prisma.boardLike.deleteMany();
        await prisma.tripBoardVideo.deleteMany();
        await prisma.tripBoard.deleteMany();
        await prisma.commentLike.deleteMany();
        await prisma.comment.deleteMany();
        await prisma.like.deleteMany();
        await prisma.save.deleteMany();
        await prisma.follow.deleteMany();
        await prisma.userBadge.deleteMany();
        await prisma.badge.deleteMany();
        await prisma.businessVerification.deleteMany();
        await prisma.boostRequest.deleteMany();
        await prisma.collaboration.deleteMany();
        await prisma.report.deleteMany();
        await prisma.notification.deleteMany();
        await prisma.featureFlag.deleteMany();
        await prisma.appVersion.deleteMany();
        await prisma.post.deleteMany();
        await prisma.session.deleteMany();
        await prisma.user.deleteMany();
    } catch (e) {
        console.warn('⚠️ Clear data warnings:', e.message);
    }
    console.log('   ✅ Cleared.\n');

    // 2. Create admin user
    console.log('👑 Creating admin user...');
    const adminPassword = await bcrypt.hash('Admin1234', SALT_ROUNDS);
    const admin = await prisma.user.create({
        data: {
            email: 'admin@travelpod.com',
            password: adminPassword,
            username: 'admin',
            displayName: 'Travelpod Admin',
            accountType: 'ADMIN',
            isAdmin: true,
            onboardingComplete: true,
            avatarUrl: generateAvatar('admin'),
            personalityTags: ['Platform', 'Management'],
            preferredRegions: ['Global'],
        },
    });
    console.log(`   ✅ Admin: admin / Admin1234\n`);

    // 3. Create users
    console.log('👥 Creating user accounts...');
    const users = [];
    const userPassword = await bcrypt.hash('Travel1234', SALT_ROUNDS);

    for (const prof of USER_PROFILES) {
        const user = await prisma.user.create({
            data: {
                email: `${prof.handle}@travelpod.test`,
                password: userPassword,
                username: prof.handle,
                displayName: prof.displayName,
                accountType: prof.accountType,
                onboardingComplete: true,
                avatarUrl: generateAvatar(prof.handle),
                personalityTags: prof.tags,
                preferredRegions: [randomFrom(LOCATIONS).split(',')[0]],
                followerCount: randomInt(50, 1000),
                followingCount: randomInt(20, 200),
            },
        });
        users.push(user);
    }
    console.log(`   ✅ ${users.length} users created.\n`);

    // 4. Create posts
    console.log('🎬 Creating travel video posts from Archive.org...');
    const posts = [];
    for (let i = 0; i < 200; i++) {
        const user = randomFrom(users);
        const video = randomFrom(VIDEO_POOL);

        const post = await prisma.post.create({
            data: {
                userId: user.id,
                videoUrl: video.url,
                thumbnailUrl: getThumbnail(video),
                title: video.title,
                description: video.description || 'Amazing travel destination!',
                duration: video.duration || randomInt(15, 120),
                category: video.category || 'Travel',
                tags: video.tags || [],
                postType: 'VIDEO',
                moderationStatus: 'APPROVED',
                viewCount: randomInt(100, 5000),
                likeCount: randomInt(10, 500),
                commentCount: randomInt(0, 50),
                saveCount: randomInt(0, 100),
                createdAt: randomDate(30),
            },
        });
        posts.push(post);
        if ((i + 1) % 50 === 0) console.log(`   📹 ${i + 1}/200 posts created...`);
    }
    console.log(`   ✅ ${posts.length} posts created.\n`);

    // 5. Interactions (Follows, Likes, Comments)
    console.log('🤝 Creating interactions...');
    for (const user of users) {
        // Follow some users
        const toFollow = users.filter(u => u.id !== user.id).sort(() => 0.5 - Math.random()).slice(0, 3);
        for (const target of toFollow) {
            await prisma.follow.create({
                data: { followerId: user.id, followingId: target.id },
            }).catch(() => { });
        }

        // Like some posts
        const toLike = posts.sort(() => 0.5 - Math.random()).slice(0, 5);
        for (const post of toLike) {
            await prisma.like.create({
                data: { userId: user.id, postId: post.id },
            }).catch(() => { });
        }
    }
    console.log('   ✅ Interactions created.\n');

    console.log('🎉 SEED COMPLETE!');
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
