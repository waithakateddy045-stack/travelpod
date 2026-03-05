// Seed Script — Official @travelpod Account (linked to admin)
// Run: node server/prisma/seed-official.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const OFFICIAL_EMAIL = 'official@travelpod.com';
const OFFICIAL_HANDLE = 'travelpod';

async function seed() {
    console.log('🌱 Setting up official @travelpod account...');

    // 1. Check if official account already exists
    let officialUser = await prisma.user.findFirst({
        where: { email: OFFICIAL_EMAIL },
    });

    if (!officialUser) {
        const bcrypt = require('bcryptjs');
        officialUser = await prisma.user.create({
            data: {
                email: OFFICIAL_EMAIL,
                hashedPassword: await bcrypt.hash('TravelPodOfficial2026!', 12),
                accountType: 'TRAVEL_AGENCY', // Professional posting account
                onboardingComplete: true,
                emailVerified: true,
            },
        });
        console.log('  ✅ Created official user: official@travelpod.com');
    } else {
        console.log('  ℹ️  Official user already exists');
    }

    // 2. Create or update profile
    let profile = await prisma.profile.findUnique({
        where: { userId: officialUser.id },
    });

    if (!profile) {
        profile = await prisma.profile.create({
            data: {
                userId: officialUser.id,
                displayName: 'Travelpod',
                handle: OFFICIAL_HANDLE,
                personalityTags: JSON.stringify(['Travel Community', 'Feature Updates', 'Travel Tips']),
                preferredRegions: JSON.stringify(['East Africa', 'West Africa', 'Southern Africa', 'North Africa', 'Southeast Asia', 'Europe', 'South America']),
                contentPreferences: JSON.stringify(['Destination Guides', 'Travel Tips', 'Feature Updates']),
            },
        });
        console.log('  ✅ Created profile: @travelpod');
    } else {
        console.log('  ℹ️  Profile @travelpod already exists');
    }

    // 3. Create business profile
    let biz = await prisma.businessProfile.findUnique({
        where: { profileId: profile.id },
    });

    if (!biz) {
        await prisma.businessProfile.create({
            data: {
                profileId: profile.id,
                country: 'Global',
                description: 'The official Travelpod account. Get feature updates, travel tips, and community highlights.',
                websiteUrl: 'https://travelpod.app',
                verificationStatus: 'APPROVED',
                verifiedAt: new Date(),
            },
        });
        console.log('  ✅ Created verified business profile');
    }

    // 4. Make all existing users follow @travelpod
    const allUsers = await prisma.user.findMany({
        where: { id: { not: officialUser.id } },
        select: { id: true },
    });

    let newFollows = 0;
    for (const u of allUsers) {
        const existing = await prisma.follow.findUnique({
            where: { followerId_followingId: { followerId: u.id, followingId: officialUser.id } },
        });
        if (!existing) {
            await prisma.follow.create({
                data: { followerId: u.id, followingId: officialUser.id },
            });
            newFollows++;
        }
    }

    // Update follower count
    await prisma.profile.update({
        where: { userId: officialUser.id },
        data: { followerCount: allUsers.length },
    });

    console.log(`  ✅ ${newFollows} new users now follow @travelpod (${allUsers.length} total)`);

    // 5. Create welcome / feature-highlight posts
    const categories = await prisma.category.findMany();
    const tipsCategory = categories.find(c => c.name.toLowerCase().includes('tip')) || categories[0];

    const FEATURE_POSTS = [
        {
            title: 'Welcome to Travelpod! 🌍',
            description: '🎉 Welcome to the world\'s first video-first travel community!\n\n'
                + '✈️ Travelpod connects travelers with verified businesses, honest video reviews, and curated trip boards.\n\n'
                + 'Here\'s what you can do:\n'
                + '• 📱 Browse the video feed — discover destinations through authentic videos\n'
                + '• 🔍 Explore — search for creators, businesses, and destinations\n'
                + '• 💬 Enquire — send booking requests directly to travel businesses\n'
                + '• 📋 Trip Boards — browse and create curated trip collections\n'
                + '• 🔔 Notifications — stay updated on follows, likes, and replies\n\n'
                + 'Follow us for feature updates and travel inspiration! 🚀',
        },
        {
            title: 'How to Create a Booking Enquiry ✉️',
            description: '📨 Want to book a trip? Here\'s how:\n\n'
                + '1. Find a travel business on the feed or explore page\n'
                + '2. Visit their profile\n'
                + '3. Tap the "Enquire" button\n'
                + '4. Fill in your travel dates, group size, budget, and message\n'
                + '5. Submit — the business will receive your request instantly!\n\n'
                + 'Once they respond, a direct message thread opens automatically so you can continue planning. 💬',
        },
        {
            title: 'Trip Boards — Your Travel Planner 📋',
            description: '📌 Trip Boards are Travelpod\'s social planning tool!\n\n'
                + 'What you can do with boards:\n'
                + '• Create boards for your upcoming trips\n'
                + '• Add videos from the feed to organize your research\n'
                + '• Browse boards from other travelers and businesses\n'
                + '• Follow boards to get notified when new videos are added\n'
                + '• Like and save boards for inspiration\n\n'
                + 'Find boards at the 🗂️ icon in the feed nav bar!',
        },
        {
            title: 'For Businesses: Get Verified ✅',
            description: '🏢 Are you a travel business on Travelpod?\n\n'
                + 'Get your verified badge to build trust with travelers:\n\n'
                + '1. Go to your profile settings\n'
                + '2. Apply for verification\n'
                + '3. Submit your business registration number and details\n'
                + '4. Our team reviews and approves your application\n'
                + '5. Your profile gets a gold verified badge!\n\n'
                + 'Verified businesses get higher visibility in search and the feed algorithm gives your posts a boost. 🚀',
        },
        {
            title: 'Upload Your First Video 🎬',
            description: '📹 Sharing is what makes Travelpod special! Here\'s how to post:\n\n'
                + '1. Tap the ➕ icon in the feed navigation\n'
                + '2. Select your video (up to 100MB)\n'
                + '3. Add a title, description, and pick a category\n'
                + '4. Tag your location — it helps other travelers find your content\n'
                + '5. Hit "Publish" and you\'re live!\n\n'
                + 'Tips for great travel videos:\n'
                + '• Keep them authentic and honest\n'
                + '• Show the real experience — good and bad\n'
                + '• Use vertical format for best mobile viewing\n'
                + '• Tag the business if you\'re reviewing one',
        },
    ];

    const PLACEHOLDER_VIDEOS = [
        'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
        'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
        'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
        'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4'
    ];

    let postsCreated = 0;
    for (let i = 0; i < FEATURE_POSTS.length; i++) {
        const fp = FEATURE_POSTS[i];
        const existing = await prisma.post.findFirst({
            where: { userId: officialUser.id, title: fp.title },
        });
        if (!existing) {
            await prisma.post.create({
                data: {
                    userId: officialUser.id,
                    title: fp.title,
                    description: fp.description,
                    videoUrl: PLACEHOLDER_VIDEOS[i % PLACEHOLDER_VIDEOS.length],
                    categoryId: tipsCategory?.id || null,
                    moderationStatus: 'APPROVED',
                },
            });
            postsCreated++;
        }
    }

    console.log(`  ✅ Created ${postsCreated} feature announcement posts`);
    console.log('\n🎉 Official @travelpod account is ready!');
    console.log('   📧 Email: official@travelpod.com');
    console.log('   🔑 Password: TravelPodOfficial2026!');
    console.log('   👤 Handle: @travelpod');
    console.log('   ✅ Verified: Yes');

    await prisma.$disconnect();
}

seed().catch(e => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
});
