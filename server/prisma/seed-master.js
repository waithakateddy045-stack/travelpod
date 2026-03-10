const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

const PEXELS_VIDEOS = [
    "https://videos.pexels.com/video-files/1562476/1562476-hd_1920_1080_30fps.mp4",
    "https://videos.pexels.com/video-files/2169880/2169880-hd_1920_1080_25fps.mp4",
    "https://videos.pexels.com/video-files/3571264/3571264-hd_1280_720_30fps.mp4",
    "https://videos.pexels.com/video-files/4763824/4763824-hd_1920_1080_24fps.mp4",
    "https://videos.pexels.com/video-files/2097972/2097972-hd_1280_720_30fps.mp4",
    "https://videos.pexels.com/video-files/3015481/3015481-hd_1920_1080_30fps.mp4",
    "https://videos.pexels.com/video-files/2499611/2499611-hd_1920_1080_30fps.mp4",
    "https://videos.pexels.com/video-files/1737012/1737012-hd_1920_1080_25fps.mp4",
    "https://videos.pexels.com/video-files/4215047/4215047-hd_1920_1080_25fps.mp4",
    "https://videos.pexels.com/video-files/2878378/2878378-hd_1920_1080_30fps.mp4",
    "https://videos.pexels.com/video-files/3249545/3249545-hd_1920_1080_25fps.mp4",
    "https://videos.pexels.com/video-files/4613527/4613527-hd_1920_1080_25fps.mp4",
    "https://videos.pexels.com/video-files/1580080/1580080-hd_1920_1080_25fps.mp4",
    "https://videos.pexels.com/video-files/3771908/3771908-hd_1920_1080_25fps.mp4",
    "https://videos.pexels.com/video-files/2103099/2103099-hd_1920_1080_25fps.mp4",
    "https://videos.pexels.com/video-files/3770253/3770253-hd_1920_1080_25fps.mp4",
    "https://videos.pexels.com/video-files/4990965/4990965-hd_1920_1080_25fps.mp4",
    "https://videos.pexels.com/video-files/2894880/2894880-hd_1920_1080_25fps.mp4",
    "https://videos.pexels.com/video-files/3571265/3571265-hd_1280_720_30fps.mp4",
    "https://videos.pexels.com/video-files/1389429/1389429-hd_1920_1080_25fps.mp4"
];

const LOCATIONS = [
    "Nairobi Kenya", "Mombasa Kenya", "Zanzibar Tanzania", "Serengeti Tanzania",
    "Masai Mara Kenya", "Bali Indonesia", "Santorini Greece", "Paris France",
    "Dubai UAE", "Cape Town South Africa", "Tokyo Japan", "New York USA",
    "London UK", "Venice Italy", "Marrakech Morocco"
];

const CATEGORIES = ["Adventure", "Safari", "Beach", "City", "Culture", "Food", "Nature", "Luxury"];

async function main() {
    console.log("🚀 Starting Nuclear Seed...");

    const passwordHash = await bcrypt.hash("Admin1234", 12);
    const userPasswordHash = await bcrypt.hash("Pass1234!", 12);

    // 1. CREATE ADMIN USER
    console.log("Creating Admin...");
    const admin = await prisma.user.create({
        data: {
            email: "admin@travelpod.com",
            password: passwordHash,
            username: "admin",
            displayName: "System Admin",
            accountType: "ADMIN",
            isAdmin: true,
            onboardingComplete: true
        }
    });

    // 2. CREATE OFFICIAL ACCOUNT
    console.log("Creating Official @travelpod...");
    const official = await prisma.user.create({
        data: {
            email: "official@travelpod.com",
            username: "travelpod",
            displayName: "Travelpod Official",
            isVerified: true,
            accountType: "TRAVEL_AGENCY",
            onboardingComplete: true,
            avatarUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=travelpod"
        }
    });

    // 3. CREATE 40 SEEDED USERS
    console.log("Creating 40 Users...");
    const users = [];

    // 15 Travelers
    for (let i = 1; i <= 15; i++) {
        users.push(await prisma.user.create({
            data: {
                email: `traveler${i}@example.com`,
                username: `traveler${i}`,
                displayName: `Explorer ${i}`,
                password: userPasswordHash,
                accountType: "TRAVELER",
                onboardingComplete: true,
                avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=traveler${i}`,
                personalityTags: ["Solo Traveler", "Foodie", "Culture Hub"],
                preferredRegions: ["Africa", "Asia", "Europe"]
            }
        }));
    }

    // 10 Hotels/Resorts
    const hotelNames = ["Sarova Stanley", "Tribe Hotel", "Hemingways Nairobi", "Villa Rosa Kempinski", "Fairmont Norfolk", "Giraffe Manor", "Sankara Nairobi", "Ole Sereni", "Radisson Blu", "Eka Hotel"];
    for (let i = 0; i < hotelNames.length; i++) {
        users.push(await prisma.user.create({
            data: {
                email: `hotel${i}@example.com`,
                username: hotelNames[i].toLowerCase().replace(/ /g, ""),
                displayName: hotelNames[i],
                password: userPasswordHash,
                accountType: "HOTEL_RESORT",
                onboardingComplete: true,
                isVerified: i < 5,
                avatarUrl: `https://api.dicebear.com/7.x/identicon/svg?seed=${hotelNames[i]}`
            }
        }));
    }

    // 8 Travel Agencies
    const agencyNames = ["Bonfire Adventures", "Eco Adventures Kenya", "Polman's Tours", "Sunworld Safaris", "Gamewatchers Safaris", "Uniglobe Travel", "Airkenya Express", "Kenya Safaris Ltd"];
    for (let i = 0; i < agencyNames.length; i++) {
        users.push(await prisma.user.create({
            data: {
                email: `agency${i}@example.com`,
                username: agencyNames[i].toLowerCase().replace(/ /g, ""),
                displayName: agencyNames[i],
                password: userPasswordHash,
                accountType: "TRAVEL_AGENCY",
                onboardingComplete: true,
                isVerified: i < 4,
                avatarUrl: `https://api.dicebear.com/7.x/shapes/svg?seed=${agencyNames[i]}`
            }
        }));
    }

    // 4 Airlines
    const airlineNames = ["Kenya Airways", "Jambojet", "Ethiopian Airlines", "Qatar Airways"];
    for (let i = 0; i < airlineNames.length; i++) {
        users.push(await prisma.user.create({
            data: {
                email: `airline${i}@example.com`,
                username: airlineNames[i].toLowerCase().replace(/ /g, ""),
                displayName: airlineNames[i],
                password: userPasswordHash,
                accountType: "AIRLINE",
                onboardingComplete: true,
                isVerified: true,
                avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${airlineNames[i]}`
            }
        }));
    }

    // 3 Destinations
    const destinationNames = ["Nairobi Tourism Board", "Mombasa Tourism", "Kenya Wildlife Service"];
    for (let i = 0; i < destinationNames.length; i++) {
        users.push(await prisma.user.create({
            data: {
                email: `destination${i}@example.com`,
                username: destinationNames[i].toLowerCase().replace(/ /g, ""),
                displayName: destinationNames[i],
                password: userPasswordHash,
                accountType: "DESTINATION",
                onboardingComplete: true,
                isVerified: true,
                avatarUrl: `https://api.dicebear.com/7.x/pixel-art/svg?seed=${destinationNames[i]}`
            }
        }));
    }

    console.log(`User list size: ${users.length}`);

    // Business Verifications for 10 verified accounts
    const verifiedUsers = users.filter(u => u.isVerified);
    for (let i = 0; i < Math.min(verifiedUsers.length, 10); i++) {
        await prisma.businessVerification.create({
            data: {
                userId: verifiedUsers[i].id,
                businessRegistrationNumber: `BR-${Math.floor(Math.random() * 900000) + 100000}`,
                businessRegistrationDocument: "https://res.cloudinary.com/demo/image/upload/sample.jpg",
                associationName: i % 2 === 0 ? "Kenya Tourism Federation" : null,
                associationMembershipNumber: i % 2 === 0 ? `KTF-${Math.floor(Math.random() * 90000) + 10000}` : null,
                associationListingUrl: i % 2 === 0 ? "https://example.com/members" : null,
                registeredWebsite: `https://${verifiedUsers[i].username}.com`,
                contactEmail: `${verifiedUsers[i].username}@example.com`,
                contactPhone: i % 3 === 0 ? "+254700000000" : null,
                physicalAddress: i % 3 === 0 ? "Nairobi, Kenya" : null,
                status: "APPROVED",
                verifiedAt: new Date()
            }
        });
    }

    // 4. CREATE 1200 POSTS
    console.log("Creating 1200 Posts...");
    const posts = [];
    for (let i = 0; i < 1200; i++) {
        const creator = users[i % users.length];
        const videoUrl = PEXELS_VIDEOS[i % PEXELS_VIDEOS.length];
        const location = LOCATIONS[i % LOCATIONS.length];
        const category = CATEGORIES[i % CATEGORIES.length];

        posts.push(await prisma.post.create({
            data: {
                userId: creator.id,
                postType: "VIDEO",
                title: `Amazing ${category} in ${location} #${i}`,
                description: `Experience the best of ${category} at ${location}. Follow for more!`,
                videoUrl,
                thumbnailUrl: videoUrl.replace(".mp4", ".jpg"), // Dummy JPG thumbnail from MP4 URL logic
                location,
                locationTag: location,
                category,
                moderationStatus: "APPROVED",
                duration: 30,
                tags: ["Travel", category, location.split(" ")[0]],
                viewCount: Math.floor(Math.random() * 10000)
            }
        }));
        if (i % 50 === 0) console.log(`Created ${i} posts...`);
    }

    // 5. CREATE 54 TRIP BOARDS
    console.log("Creating 54 Trip Boards...");
    const boardTitles = [
        "Kenya Safari 2026", "Bali Honeymoon", "Best of Zanzibar", "East Africa Road Trip",
        "Mediterranean Summer", "Dubai Luxury Escape", "Paris Romantic Getaway", "Tokyo Street Food Tour"
    ];
    const boards = [];
    for (let i = 0; i < 54; i++) {
        const creator = users[i % users.length];
        const titleBase = boardTitles[i % boardTitles.length];
        const board = await prisma.tripBoard.create({
            data: {
                userId: creator.id,
                title: `${titleBase} ${Math.floor(i / 8) + 1}`,
                description: `A collection of my favorite moments from ${titleBase}.`,
                destination: titleBase.split(" ").slice(-1)[0],
                isPublic: true
            }
        });
        boards.push(board);

        // Add 5-8 random posts to board
        const randomPosts = [...posts].sort(() => 0.5 - Math.random()).slice(0, Math.floor(Math.random() * 4) + 5);
        for (const post of randomPosts) {
            await prisma.tripBoardVideo.create({
                data: {
                    boardId: board.id,
                    postId: post.id
                }
            }).catch(() => { }); // ignore unique constraint errors if any
        }
    }

    // 6. CREATE ENGAGEMENT DATA
    console.log("Creating Engagement (Likes, Comments, Saves, Follows)...");

    // Likes
    let likesCreated = 0;
    for (let i = 0; i < 5000; i++) {
        const user = users[Math.floor(Math.random() * users.length)];
        const post = posts[Math.floor(Math.random() * posts.length)];
        await prisma.like.create({
            data: { userId: user.id, postId: post.id }
        }).then(async () => {
            await prisma.post.update({ where: { id: post.id }, data: { likeCount: { increment: 1 } } });
            await prisma.user.update({ where: { id: post.userId }, data: { totalLikes: { increment: 1 } } });
            likesCreated++;
        }).catch(() => { });
        if (i % 1000 === 0) console.log(`Created ${i} likes...`);
    }

    // Comments
    const commentTexts = ["This place is incredible!", "Adding this to my bucket list!", "The food here is amazing!", "Wow, look at that view!", "Great tips, thanks for sharing!", "I need to go here ASAP!", "Amazing cinematic shots!", "Kenya is beautiful!"];
    for (let i = 0; i < 1000; i++) {
        const user = users[Math.floor(Math.random() * users.length)];
        const post = posts[Math.floor(Math.random() * posts.length)];
        await prisma.comment.create({
            data: {
                userId: user.id,
                postId: post.id,
                content: commentTexts[Math.floor(Math.random() * commentTexts.length)],
                commentType: "COMMENT"
            }
        });
        await prisma.post.update({ where: { id: post.id }, data: { commentCount: { increment: 1 } } });
    }

    // Saves
    for (let i = 0; i < 500; i++) {
        const user = users[Math.floor(Math.random() * users.length)];
        const post = posts[Math.floor(Math.random() * posts.length)];
        await prisma.save.create({
            data: { userId: user.id, postId: post.id }
        }).then(async () => {
            await prisma.post.update({ where: { id: post.id }, data: { saveCount: { increment: 1 } } });
        }).catch(() => { });
    }

    // Follows
    console.log("Creating Follow relationships...");
    for (const user of users) {
        // Follow official account
        await prisma.follow.create({
            data: { followerId: user.id, followingId: official.id }
        }).catch(() => { });

        // Randomly follow 10-20 others
        const followCount = Math.floor(Math.random() * 11) + 10;
        const others = users.filter(u => u.id !== user.id).sort(() => 0.5 - Math.random()).slice(0, followCount);
        for (const other of others) {
            await prisma.follow.create({
                data: { followerId: user.id, followingId: other.id }
            }).catch(() => { });
        }
    }

    // 7. CREATE FEATURE FLAGS
    console.log("Creating Feature Flags...");
    const flags = [
        { name: "sponsored_promotions", isEnabled: false, description: "Boost Post feature for businesses" },
        { name: "gamification", isEnabled: false, description: "Badges and achievements system" },
        { name: "collaborations", isEnabled: false, description: "Brand and creator collaboration requests" }
    ];
    for (const flag of flags) {
        await prisma.featureFlag.create({ data: flag });
    }

    // 8. CREATE APP VERSION
    console.log("Creating App Version...");
    await prisma.appVersion.create({
        data: {
            currentVersion: "1.0.5",
            minimumVersion: "1.0.5",
            forceUpdate: false,
            releaseNotes: "Bug fixes and performance improvements",
            downloadUrl: "https://github.com/waithakateddy045-stack/travelpod/releases/latest"
        }
    });

    // 9. SEED BADGES
    console.log("Seeding Badges...");
    const badgesData = [
        { name: "🌍 Explorer", tier: "BRONZE", icon: "🌍", description: "Uploaded first video", criteria: { type: "posts", count: 1 } },
        { name: "✈️ Frequent Flyer", tier: "SILVER", icon: "✈️", description: "Uploaded 10 videos", criteria: { type: "posts", count: 10 } },
        { name: "🦁 Safari King", tier: "GOLD", icon: "🦁", description: "Posted Africa/Kenya content 5 times", criteria: { type: "posts", count: 5, category: "Safari" } },
        { name: "🏖️ Beach Lover", tier: "SILVER", icon: "🏖️", description: "Posted beach content 5 times", criteria: { type: "posts", count: 5, category: "Beach" } },
        { name: "💫 Rising Star", tier: "BRONZE", icon: "💫", description: "Received 100 likes", criteria: { type: "likes", count: 100 } },
        { name: "⭐ Influencer", tier: "GOLD", icon: "⭐", description: "Received 1000 likes", criteria: { type: "likes", count: 1000 } },
        { name: "🤝 Social Butterfly", tier: "BRONZE", icon: "🤝", description: "Followed 50 people", criteria: { type: "following", count: 50 } },
        { name: "📸 Content Creator", tier: "SILVER", icon: "📸", description: "Uploaded 25 videos", criteria: { type: "posts", count: 25 } },
        { name: "🏆 Verified Partner", tier: "GOLD", icon: "🏆", description: "Got business verification", criteria: { type: "verification", status: "APPROVED" } },
        { name: "👑 Travelpod Elite", tier: "PLATINUM", icon: "👑", description: "Received 10000 likes", criteria: { type: "likes", count: 10000 } }
    ];
    for (const badge of badgesData) {
        await prisma.badge.create({ data: badge });
    }

    // 10. CREATE 5 PINNED POSTS on @travelpod
    console.log("Creating 5 Pinned Posts for @travelpod...");
    const pinnedPosts = [
        { title: "Welcome to Travelpod 🌍", desc: "The future of video-first travel is here. Discover, connect, and explore like never before." },
        { title: "How to Use Trip Boards 🗺️", desc: "Plan your next adventure by saving videos to your personal or public Trip Boards." },
        { title: "Business Verification ✅", desc: "Get established as a trusted travel provider and reach more customers directly." },
        { title: "How to Book Travel 📅", desc: "Inquire about services directly through the app to start your booking journey." },
        { title: "Upload Your Travel Story 🎬", desc: "Share your honest experiences and tips with the community to earn rewards." }
    ];
    for (let i = 0; i < pinnedPosts.length; i++) {
        await prisma.post.create({
            data: {
                userId: official.id,
                postType: "VIDEO",
                title: pinnedPosts[i].title,
                description: pinnedPosts[i].desc,
                videoUrl: PEXELS_VIDEOS[i % PEXELS_VIDEOS.length],
                thumbnailUrl: PEXELS_VIDEOS[i % PEXELS_VIDEOS.length].replace(".mp4", ".jpg"),
                moderationStatus: "APPROVED",
                isPinned: true,
                duration: 30,
                category: "Culture"
            }
        });
    }

    console.log("✅ Seed Successful!");
    console.log("--------------------------------");
    const userCount = await prisma.user.count();
    const postCount = await prisma.post.count();
    const boardCount = await prisma.tripBoard.count();
    const likeCount = await prisma.like.count();
    const followCount = await prisma.follow.count();

    console.log(`Summary:`);
    console.log(`- Users: ${userCount}`);
    console.log(`- Posts: ${postCount}`);
    console.log(`- Boards: ${boardCount}`);
    console.log(`- Likes: ${likeCount}`);
    console.log(`- Follows: ${followCount}`);
    console.log(`- Admin Credentials: admin@travelpod.com / Admin1234`);
    console.log("--------------------------------");

}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
