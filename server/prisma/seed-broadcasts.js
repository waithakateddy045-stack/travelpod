const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

async function main() {
    console.log("🚀 Seeding Broadcast Posts for existing users...");

    // Get Official Account. If missing, create.
    const passwordHash = await bcrypt.hash("Pass1234!", 12);
    let official = await prisma.user.upsert({
        where: { email: "official@travelpod.com" },
        update: {},
        create: {
            email: "official@travelpod.com",
            password: passwordHash,
            username: "travelpod",
            displayName: "Travelpod Official",
            isVerified: true,
            accountType: "TRAVEL_AGENCY",
            onboardingComplete: true,
            avatarUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=travelpod"
        }
    });

    // Get all Business Accounts (HOTEL_RESORT, TRAVEL_AGENCY, AIRLINE)
    const businessUsers = await prisma.user.findMany({
        where: {
            accountType: { in: ['HOTEL_RESORT', 'TRAVEL_AGENCY', 'AIRLINE'] }
        }
    });

    if (businessUsers.length === 0) {
        console.log("No business users found. Run seed-master.js first.");
        return;
    }

    const LOCATIONS = [
        "Aurora Fjords, Nordica", "Emerald Dunes, Solana", "Safari Ridge, Kifaru Reserve", "Lagoon Keys, Marala",
        "Crimson Canyons, Roja", "Mist Valley, Eldoria", "Harbor Lights, Marisport", "Sunrise Peaks, Altura",
    ];
    const CATEGORIES = ["Destinations", "Hotels & Resorts", "Adventures & Activities", "City Life", "Beach", "Safari", "Nature", "Culture & History"];

    console.log("Creating ~60 Business Broadcast Posts...");
    for (let i = 0; i < 60; i++) {
        const creator = businessUsers[Math.floor(Math.random() * businessUsers.length)];
        const location = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];
        const category = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];

        const sectors = ['Travelers', 'Hotels & Resorts', 'Airlines', 'Travel Agencies', 'All'];
        const broadcastSector = sectors[Math.floor(Math.random() * sectors.length)];
        const broadcastRegion = location.split(" ")[0];

        await prisma.post.create({
            data: {
                userId: creator.id,
                postType: 'TEXT',
                title: `Exclusive Update from ${creator.displayName} #${i}`,
                description: `Exciting news and updates from ${creator.displayName} regarding ${category.toLowerCase()} in ${location}.`,
                location,
                locationTag: location,
                category,
                isBroadcast: true,
                broadcastSector,
                broadcastRegion,
                tags: ["Travel", category, broadcastRegion],
                viewCount: Math.floor(Math.random() * 10000),
                moderationStatus: 'APPROVED'
            }
        });
    }

    console.log("Creating 20 Official Broadcast Guideline Posts...");
    const guidelineTitles = [
        "Welcome to Travelpod Mobile", "How to Verify Your Business", "Using the Feed Algorithm",
        "Booking Security Tips", "Reporting Inappropriate Content", "Trip Boards Best Practices",
        "Creating Viral Videos", "Monetization Guidelines", "Updates to Privacy Policy",
        "Connecting with fellow Travelers", "How to Use Filters", "Messaging Safely",
        "Finding Local Gems", "Sustainable Travel Tips", "Feature Request Tracker",
        "Partner Network Benefits", "Weekly Travel Digest #1", "Uploading HD Media",
        "Respecting Cultural Norms", "Contacting Support"
    ];

    for (let i = 0; i < 20; i++) {
        const title = guidelineTitles[i] || `Travelpod Guide #${i}`;
        const description = `Official guidelines and updates from the Travelpod team regarding ${title.toLowerCase()}. Please adhere to these best practices to maintain a healthy ecosystem.`;

        await prisma.post.create({
            data: {
                userId: official.id,
                postType: 'TEXT',
                title,
                description,
                isBroadcast: true,
                broadcastSector: 'All',
                broadcastRegion: 'Global',
                tags: ["Guidelines", "Official", "Help"],
                viewCount: Math.floor(Math.random() * 50000),
                moderationStatus: 'APPROVED'
            }
        });
    }

    console.log("✅ Successfully seeded broadcast posts.");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
