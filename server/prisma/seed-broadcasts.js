/**
 * seed-broadcasts.js
 * Seeds BroadcastPost records so the Broadcasts tab in the feed has content.
 * Run: node prisma/seed-broadcasts.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const BROADCASTS = [
    {
        title: '🌍 Discover Africa Like Never Before',
        message: 'From the sweeping plains of the Serengeti to the white sand beaches of Zanzibar — Africa is calling. Our curated travel packages include guided safaris, beach retreats, and cultural deep-dives. Book now and experience the continent of wonder.',
        videoUrl: 'https://videos.pexels.com/video-files/3571264/3571264-hd_1280_720_30fps.mp4',
        thumbnailUrl: 'https://images.pexels.com/photos/247502/pexels-photo-247502.jpeg',
        sectorTargeting: ['TRAVELER'],
    },
    {
        title: '✈️ Exclusive Flight Deals: Save Up to 40%',
        message: 'Limited-time flash sale on international routes. Fly from Nairobi, Lagos, Cairo, and Johannesburg to top destinations in Europe, Asia, and the Americas. Book through Travelpod partner airlines and unlock exclusive app-only discounts.',
        videoUrl: 'https://videos.pexels.com/video-files/2169880/2169880-hd_1920_1080_25fps.mp4',
        thumbnailUrl: 'https://images.pexels.com/photos/1309644/pexels-photo-1309644.jpeg',
        sectorTargeting: ['TRAVELER', 'TRAVEL_AGENCY'],
    },
    {
        title: '🏨 5-Star Beach Resorts: Maldives & Seychelles',
        message: 'Overwater bungalows, crystal clear lagoons, and world-class dining. We have secured special rates for our Travelpod community at award-winning beach resorts across the Indian Ocean. Paradise is closer than you think.',
        videoUrl: 'https://videos.pexels.com/video-files/1562476/1562476-hd_1920_1080_30fps.mp4',
        thumbnailUrl: 'https://images.pexels.com/photos/1268855/pexels-photo-1268855.jpeg',
        sectorTargeting: ['TRAVELER'],
    },
    {
        title: '🦁 Safari Season Alert: Wildebeest Migration',
        message: 'The Great Wildebeest Migration is in full swing. Over 1.5 million animals crossing the Mara River — a truly once-in-a-lifetime spectacle. Our partner lodges in the Masai Mara still have limited availability for this season.',
        videoUrl: 'https://videos.pexels.com/video-files/4763824/4763824-hd_1920_1080_24fps.mp4',
        thumbnailUrl: 'https://images.pexels.com/photos/631292/pexels-photo-631292.jpeg',
        sectorTargeting: ['TRAVELER'],
    },
    {
        title: '🗺️ New Feature: Trip Boards Are Here!',
        message: 'You can now save videos to curated Trip Boards — plan your dream trip by collecting travel videos from different destinations, hotels, and experiences into one shareable board. Tap "Save to Board" on any video to get started!',
        videoUrl: 'https://videos.pexels.com/video-files/3015481/3015481-hd_1920_1080_30fps.mp4',
        thumbnailUrl: 'https://images.pexels.com/photos/2108813/pexels-photo-2108813.jpeg',
        sectorTargeting: [],
    },
    {
        title: '🏔️ Himalayan Trek: Nepal Adventure Packages',
        message: 'Experience the roof of the world. Our certified Nepal adventure guides offer Everest Base Camp treks, Annapurna Circuit, and Langtang Valley hikes. All inclusive packages with accommodation, permits, and porter services included.',
        videoUrl: 'https://videos.pexels.com/video-files/2097972/2097972-hd_1280_720_30fps.mp4',
        thumbnailUrl: 'https://images.pexels.com/photos/1365425/pexels-photo-1365425.jpeg',
        sectorTargeting: ['TRAVELER'],
    },
    {
        title: '🍜 Street Food Tours: Southeast Asia',
        message: 'Bangkok night markets, Hanoi pho stalls, Singapore hawker centres, and Penang's legendary food scene. Our culinary travel experts have mapped the best street food routes across Southeast Asia for the ultimate foodie adventure.',
        videoUrl: 'https://videos.pexels.com/video-files/2499611/2499611-hd_1920_1080_30fps.mp4',
        thumbnailUrl: 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg',
        sectorTargeting: ['TRAVELER'],
    },
    {
        title: '💼 Business Travel Perks for Verified Members',
        message: 'Travelpod verified businesses now enjoy priority lounge access, dedicated account managers, and bulk booking discounts. Apply for business verification today to unlock exclusive corporate travel benefits for your team.',
        videoUrl: 'https://videos.pexels.com/video-files/1737012/1737012-hd_1920_1080_25fps.mp4',
        thumbnailUrl: 'https://images.pexels.com/photos/1181406/pexels-photo-1181406.jpeg',
        sectorTargeting: ['TRAVEL_AGENCY', 'HOTEL_RESORT', 'AIRLINE', 'ASSOCIATION'],
    },
    {
        title: '🌊 Ocean Escapes: Caribbean Island Hopping',
        message: 'Jamaica, Barbados, St. Lucia, Trinidad — the Caribbean archipelago is a treasure chest of beaches, rum shacks, and reggae vibes. Our island hopping packages let you explore multiple destinations in one epic trip.',
        videoUrl: 'https://videos.pexels.com/video-files/4215047/4215047-hd_1920_1080_25fps.mp4',
        thumbnailUrl: 'https://images.pexels.com/photos/994605/pexels-photo-994605.jpeg',
        sectorTargeting: ['TRAVELER'],
    },
    {
        title: '🎭 Cultural Immersion: Europe Heritage Tours',
        message: 'From the ancient ruins of Rome to the medieval old town of Prague, from Parisian cafés to Amsterdam canal houses. Our slow travel heritage tours give you time to absorb the history and culture of Europe's most iconic cities.',
        videoUrl: 'https://videos.pexels.com/video-files/2878378/2878378-hd_1920_1080_30fps.mp4',
        thumbnailUrl: 'https://images.pexels.com/photos/161853/eiffel-tower-paris-france-161853.jpeg',
        sectorTargeting: ['TRAVELER'],
    },
];

async function seed() {
    console.log('🌱 Seeding broadcasts...');

    // Find the admin user to be the sender
    let sender = await prisma.user.findFirst({
        where: { accountType: 'ADMIN' },
        select: { id: true },
    });

    // If no admin, find a business account
    if (!sender) {
        sender = await prisma.user.findFirst({
            where: { accountType: { in: ['TRAVEL_AGENCY', 'AIRLINE', 'DESTINATION'] } },
            select: { id: true },
        });
    }

    if (!sender) {
        console.error('❌ No suitable sender found. Please ensure an admin or business account exists.');
        return;
    }

    console.log(`   Using sender ID: ${sender.id}`);

    // Get all target users
    const allUsers = await prisma.user.findMany({
        where: { isSuspended: false, isDeleted: false },
        select: { id: true, accountType: true },
    });

    let created = 0;
    for (const bc of BROADCASTS) {
        try {
            // Create backing post
            const post = await prisma.post.create({
                data: {
                    userId: sender.id,
                    title: bc.title,
                    description: bc.message,
                    videoUrl: bc.videoUrl,
                    thumbnailUrl: bc.thumbnailUrl,
                    duration: 30,
                    postType: 'BROADCAST',
                    moderationStatus: 'APPROVED',
                },
            });

            // Create broadcast record
            const broadcast = await prisma.broadcastPost.create({
                data: {
                    postId: post.id,
                    senderId: sender.id,
                    sectorTargeting: bc.sectorTargeting,
                    mediaUrls: [bc.videoUrl],
                    mediaType: 'VIDEO',
                },
            });

            // Target users — all users or filtered by sector
            let targets = allUsers;
            if (bc.sectorTargeting.length > 0) {
                targets = allUsers.filter(u => bc.sectorTargeting.includes(u.accountType) || u.accountType === 'TRAVELER');
            }

            // Create broadcast targets
            await prisma.broadcastTarget.createMany({
                data: targets
                    .filter(u => u.id !== sender.id)
                    .map(u => ({
                        broadcastId: broadcast.id,
                        targetUserId: u.id,
                    })),
                skipDuplicates: true,
            });

            // Update reach count
            await prisma.broadcastPost.update({
                where: { id: broadcast.id },
                data: { reachCount: targets.length },
            });

            created++;
            console.log(`   ✅ Created broadcast: "${bc.title}"`);
        } catch (err) {
            console.error(`   ❌ Failed: "${bc.title}" —`, err.message);
        }
    }

    console.log(`\n🎉 Done! Created ${created} broadcasts out of ${BROADCASTS.length}.`);
}

seed()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
