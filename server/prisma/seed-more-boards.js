/**
 * seed-more-boards.js
 * Seeds additional trip boards with videos from the database.
 * Run: node prisma/seed-more-boards.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const BOARD_TEMPLATES = [
    {
        title: 'Kenya Safari Dream Trip',
        description: 'Planning my ultimate Kenyan safari — Masai Mara game drives, Amboseli elephant watching, and local Maasai village experiences.',
        destination: 'Kenya, Africa',
        tags: ['kenya', 'safari', 'wildlife', 'africa'],
        estimatedBudget: '$3,000 - $5,000',
        isPublic: true,
    },
    {
        title: 'Bali Escape 2026',
        description: 'Rice terraces, temple sunsets, and surfing lessons. My complete Bali itinerary — Ubud, Seminyak, Nusa Penida, and the Gili Islands.',
        destination: 'Bali, Indonesia',
        tags: ['bali', 'indonesia', 'beach', 'tropical', 'surf'],
        estimatedBudget: '$1,500 - $2,500',
        isPublic: true,
    },
    {
        title: 'European Winter Getaway',
        description: 'Christmas markets in Vienna, ski slopes in the Swiss Alps, and hot chocolate in Bruges. Winter in Europe is magical.',
        destination: 'Europe',
        tags: ['europe', 'winter', 'ski', 'christmas', 'alps'],
        estimatedBudget: '$4,000 - $7,000',
        isPublic: true,
    },
    {
        title: 'Japan Cherry Blossom Season',
        description: 'Sakura season in Tokyo, Kyoto temples, bullet train adventures, and traditional ryokan stays. The land of the rising sun at its most beautiful.',
        destination: 'Japan',
        tags: ['japan', 'tokyo', 'kyoto', 'sakura', 'asia'],
        estimatedBudget: '$3,500 - $5,500',
        isPublic: true,
    },
    {
        title: 'Maldives Luxury Honeymoon',
        description: 'Overwater bungalow bliss, crystal-clear lagoons, and sunset dinners. The ultimate romantic escape for the honeymoon of a lifetime.',
        destination: 'Maldives',
        tags: ['maldives', 'honeymoon', 'luxury', 'beach', 'romance'],
        estimatedBudget: '$6,000 - $12,000',
        isPublic: true,
    },
    {
        title: 'Morocco Desert Adventure',
        description: 'Marrakech medina wandering, Sahara Desert camel treks, and stargazing from a Berber camp. North Africa's most iconic journey.',
        destination: 'Morocco, North Africa',
        tags: ['morocco', 'marrakech', 'sahara', 'desert', 'africa'],
        estimatedBudget: '$1,800 - $3,000',
        isPublic: true,
    },
    {
        title: 'South America Bucket List',
        description: 'Machu Picchu at sunrise, Amazon rainforest expeditions, Patagonian hikes, and Carnival in Rio. The continent that has it all.',
        destination: 'South America',
        tags: ['peru', 'brazil', 'machu picchu', 'amazon', 'patagonia'],
        estimatedBudget: '$4,500 - $8,000',
        isPublic: true,
    },
    {
        title: 'Thailand Island Hopping',
        description: 'Koh Samui sunset cocktails, Koh Tao diving, Koh Phi Phi cliffs, and the Full Moon Party on Koh Phangan. Thailand's island chain done right.',
        destination: 'Thailand',
        tags: ['thailand', 'koh samui', 'diving', 'islands', 'beach'],
        estimatedBudget: '$1,200 - $2,000',
        isPublic: true,
    },
    {
        title: 'New York City Long Weekend',
        description: 'Central Park mornings, Times Square nights, Brooklyn Bridge walks, and the best pizza and bagels on the planet. NYC never sleeps.',
        destination: 'New York City, USA',
        tags: ['new york', 'usa', 'city', 'manhattan', 'brooklyn'],
        estimatedBudget: '$2,000 - $3,500',
        isPublic: true,
    },
    {
        title: 'Santorini Greece Sunset Tour',
        description: 'Blue-domed churches in Oia, volcanic beaches, wine tasting in local vineyards, and the most famous sunset in the world. Greece in full bloom.',
        destination: 'Santorini, Greece',
        tags: ['santorini', 'greece', 'europe', 'sunset', 'island'],
        estimatedBudget: '$3,000 - $5,000',
        isPublic: true,
    },
    {
        title: 'Cape Town & Garden Route',
        description: 'Table Mountain hikes, Boulders Beach penguins, great white shark cage diving, and the scenic Garden Route. South Africa at its finest.',
        destination: 'Cape Town, South Africa',
        tags: ['cape town', 'south africa', 'africa', 'garden route', 'safari'],
        estimatedBudget: '$2,500 - $4,000',
        isPublic: true,
    },
    {
        title: 'Dubai Luxury Weekend',
        description: 'Burj Khalifa views, desert dune bashing, gold souk shopping, and rooftop brunches overlooking the skyline. Dubai does luxury like nowhere else.',
        destination: 'Dubai, UAE',
        tags: ['dubai', 'uae', 'luxury', 'middle east', 'desert'],
        estimatedBudget: '$3,000 - $6,000',
        isPublic: true,
    },
    {
        title: 'Zanzibar Beach & Spice Tour',
        description: 'Stone Town ancient alleys, pristine white-sand beaches, dhow sailing, and spice farm tours. Tanzania's spice island is pure paradise.',
        destination: 'Zanzibar, Tanzania',
        tags: ['zanzibar', 'tanzania', 'africa', 'beach', 'spice island'],
        estimatedBudget: '$1,500 - $2,800',
        isPublic: true,
    },
    {
        title: 'Iceland Northern Lights Chase',
        description: 'Aurora borealis hunting, Blue Lagoon geothermal baths, glacier hiking, and whale watching from Reykjavik. Iceland\'s raw natural wonder never disappoints.',
        destination: 'Iceland',
        tags: ['iceland', 'northern lights', 'aurora', 'glacier', 'europe'],
        estimatedBudget: '$3,500 - $6,000',
        isPublic: true,
    },
    {
        title: 'Amalfi Coast Road Trip',
        description: 'Positano cliff houses, Ravello gardens, Capri island day trips, and fresh seafood pasta overlooking the Mediterranean. Italy's most breathtaking coastline.',
        destination: 'Amalfi Coast, Italy',
        tags: ['italy', 'amalfi', 'positano', 'mediterranean', 'europe'],
        estimatedBudget: '$2,500 - $4,500',
        isPublic: true,
    },
];

async function seed() {
    console.log('🌱 Seeding additional trip boards...\n');

    // Get all active users to distribute boards across
    const users = await prisma.user.findMany({
        where: { isSuspended: false, isDeleted: false, profile: { isNot: null } },
        select: { id: true },
        take: 56,
    });

    if (users.length === 0) {
        console.error('❌ No active users found.');
        return;
    }

    // Get some existing approved posts to use as board videos
    const approvedPosts = await prisma.post.findMany({
        where: { moderationStatus: 'APPROVED' },
        select: { id: true, thumbnailUrl: true },
        take: 200,
    });

    console.log(`   Found ${users.length} users and ${approvedPosts.length} posts to work with.\n`);

    let created = 0;

    for (let i = 0; i < BOARD_TEMPLATES.length; i++) {
        const template = BOARD_TEMPLATES[i];
        // Cycle through users to distribute boards
        const user = users[i % users.length];

        try {
            // Pick a cover image from an existing post thumbnail
            const coverPost = approvedPosts[i % approvedPosts.length];

            const board = await prisma.tripBoard.create({
                data: {
                    userId: user.id,
                    title: template.title,
                    description: template.description,
                    destination: template.destination,
                    estimatedBudget: template.estimatedBudget,
                    coverImage: coverPost?.thumbnailUrl || null,
                    isPublic: template.isPublic,
                    likeCount: Math.floor(Math.random() * 150),
                    followerCount: Math.floor(Math.random() * 80),
                    saveCount: Math.floor(Math.random() * 60),
                },
            });

            // Add 8-15 random videos to this board
            const videoCount = 8 + Math.floor(Math.random() * 8);
            const shuffled = [...approvedPosts].sort(() => Math.random() - 0.5).slice(0, videoCount);

            for (let j = 0; j < shuffled.length; j++) {
                try {
                    await prisma.tripBoardVideo.create({
                        data: {
                            boardId: board.id,
                            postId: shuffled[j].id,
                            sortOrder: j,
                        },
                    });
                } catch (e) {
                    // Skip duplicate video-board combos
                }
            }

            // Update video count
            await prisma.tripBoard.update({
                where: { id: board.id },
                data: { videoCount: shuffled.length },
            });

            created++;
            console.log(`   ✅ Created board: "${template.title}" (${shuffled.length} videos)`);
        } catch (err) {
            console.error(`   ❌ Failed: "${template.title}" —`, err.message);
        }
    }

    const total = await prisma.tripBoard.count({ where: { isPublic: true } });
    console.log(`\n🎉 Done! Created ${created} boards. Total public boards in DB: ${total}`);
}

seed()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
