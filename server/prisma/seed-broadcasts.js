const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const OFFICIAL_EMAIL = 'official@travelpod.com';

const TEXT_BROADCASTS = [
    { title: 'New Feature: AI Copilot! ✨', content: 'We just launched the Travelpod AI Copilot! Your personal travel assistant is now live. Chat with it in the bottom right corner for trip planning and content help.' },
    { title: 'Exploring Zanzibar 🏖️', content: 'Zanzibar is calling! From Stone Town to the white sands of Nungwi, discover the spice island like never before on Travelpod.' },
    { title: 'Sustainable Travel Tips 🌿', content: 'Did you know? Choosing eco-friendly stays can reduce your travel footprint by 40%. Check out our new "Eco-Resorts" category.' },
    { title: 'South African Safari 🦁', content: 'The Big Five are waiting. Book your Kruger National Park experience directly through verified agencies on Travelpod today.' },
    { title: 'Community Guidelines Update 🛡️', content: 'We\'ve updated our safety features to keep your travel reviews authentic and helpful. Read more in our Copyright page.' },
    { title: 'Hidden Gems in Nairobi 🇰🇪', content: 'Beyond the park, discover Nairobi\'s vibrant coffee culture and art scene. Tap the location tag to see more.' },
    { title: 'Travelpod for Businesses 🏢', content: 'Are you a verified business? Use the new Network Broadcast feature to reach thousands of travelers instantly.' },
    { title: 'Packing for the Sahara 🏜️', content: 'Light layers, plenty of water, and a good camera. What\'s your must-have desert travel item?' },
    { title: 'Direct Booking Enquiries ✉️', content: 'Skip the middleman. Send an enquiry directly to hotels and destinations from their profile. It\'s fast and free!' },
    { title: 'Video Review Contest! 🎬', content: 'Post your best 60-second travel review this month for a chance to be featured on our official Board!' },
    { title: 'Visit Victoria Falls 🌊', content: 'The Smoke that Thunders. Experience the majesty of the world\'s largest waterfall with our top-rated guides.' },
    { title: 'Traveler Badges live! 🏅', content: 'Are you an "Explorer" or a "Reviewer"? Check your profile to see your earning progress.' },
    { title: 'Moroccan Oasis 🇲🇦', content: 'Lose yourself in the blue streets of Chefchaouen. Authentic Moroccan experiences are just a scroll away.' },
    { title: 'Safety First in Travel 🛑', content: 'Always check local travel advisories. Travelpod helps you connect with locals for the most up-to-date info.' },
    { title: 'Join the Travelpod Community! 🤝', content: 'Follow your favorite creators and build your own Trip Boards to plan your dream vacation.' }
];

const IMAGE_BROADCASTS = [
    {
        title: 'Luxurious Stay in Cape Town 🏨',
        content: 'Experience world-class luxury with views of Table Mountain. Our verified partners offer exclusive rates for Travelpod members.',
        images: [
            'https://images.unsplash.com/photo-1580273916550-e323be2ae537?auto=format&fit=crop&q=80&w=800',
            'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&q=80&w=800',
            'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&q=80&w=800'
        ]
    },
    {
        title: 'Adventures in the Atlas Mountains ⛰️',
        content: 'Trek through Berber villages and breathtaking peaks. These slides show the raw beauty of Morocco.',
        images: [
            'https://images.unsplash.com/photo-1489447068241-b3490214e8f5?auto=format&fit=crop&q=80&w=800',
            'https://images.unsplash.com/photo-1539650116574-8efeb43e2750?auto=format&fit=crop&q=80&w=800'
        ]
    },
    {
        title: 'Seychelles Paradise 🇸🇨',
        content: 'The ultimate beach getaway. Swipe to see the crystal clear waters and granite boulders of La Digue.',
        images: [
            'https://images.unsplash.com/photo-1473445733995-860ccda960ea?auto=format&fit=crop&q=80&w=800',
            'https://images.unsplash.com/photo-1589553416260-178fa415956c?auto=format&fit=crop&q=80&w=800',
            'https://images.unsplash.com/photo-1544735716-e9259469e574?auto=format&fit=crop&q=80&w=800'
        ]
    },
    {
        title: 'Cairo: History Reimagined 🇪🇬',
        content: 'Visit the Giza Pyramids and the new Grand Egyptian Museum. History comes alive on Travelpod.',
        images: [
            'https://images.unsplash.com/photo-1503177119275-0aa32b3a9368?auto=format&fit=crop&q=80&w=800',
            'https://images.unsplash.com/photo-1539768942823-28b1a96eaa39?auto=format&fit=crop&q=80&w=800',
            'https://images.unsplash.com/photo-1572204090538-406c7e974e3e?auto=format&fit=crop&q=80&w=800'
        ]
    }
];

async function seed() {
    console.log('🌱 Seeding Broadcast Data...');

    const officialUser = await prisma.user.findUnique({
        where: { email: OFFICIAL_EMAIL }
    });

    if (!officialUser) {
        console.error('❌ Official user not found. Please run seed-official.js first.');
        process.exit(1);
    }

    // Clear existing broadcasts to avoid duplicates during testing if needed
    // await prisma.broadcastPost.deleteMany({ where: { senderId: officialUser.id } });

    console.log(`  👤 Using sender: @travelpod (${officialUser.id})`);

    // 1. Seed Text Broadcasts
    for (const b of TEXT_BROADCASTS) {
        const post = await prisma.post.create({
            data: {
                userId: officialUser.id,
                title: b.title,
                description: b.content,
                postType: 'BROADCAST',
                moderationStatus: 'APPROVED',
            }
        });

        await prisma.broadcastPost.create({
            data: {
                postId: post.id,
                senderId: officialUser.id,
                mediaType: 'TEXT',
                sectorTargeting: ['Traveler'],
                mediaUrls: []
            }
        });
    }
    console.log(`  ✅ Seeded ${TEXT_BROADCASTS.length} text broadcasts`);

    // 2. Seed Image Slide Broadcasts
    for (const b of IMAGE_BROADCASTS) {
        const post = await prisma.post.create({
            data: {
                userId: officialUser.id,
                title: b.title,
                description: b.content,
                postType: 'BROADCAST',
                moderationStatus: 'APPROVED',
                thumbnailUrl: b.images[0]
            }
        });

        await prisma.broadcastPost.create({
            data: {
                postId: post.id,
                senderId: officialUser.id,
                mediaType: 'IMAGE',
                sectorTargeting: ['Traveler'],
                mediaUrls: b.images
            }
        });
    }
    console.log(`  ✅ Seeded ${IMAGE_BROADCASTS.length} image broadcasts`);

    console.log('\n🎉 Finished seeding broadcast data!');
    await prisma.$disconnect();
}

seed().catch(e => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
});
