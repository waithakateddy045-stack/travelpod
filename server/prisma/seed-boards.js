// Seed Script — 50+ Example Trip Boards
// Run: node server/prisma/seed-boards.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const BOARDS = [
    // ── Kenya ────────────────────────────
    { title: 'My Kenya Safari 2026', desc: 'Two weeks across the Maasai Mara, Amboseli, and Tsavo', dest: 'Kenya', type: 'TRAVELER' },
    { title: 'Best of Nairobi — Street Food Tour', desc: 'The ultimate Nairobi food crawl from Westlands to Lang\'ata', dest: 'Kenya', type: 'TRAVELER' },
    { title: 'Ultimate Safari Package — 7 Days', desc: 'Curated luxury safari experience through Kenya\'s top reserves', dest: 'Kenya', type: 'TRAVEL_AGENCY' },
    { title: 'Mount Kenya Summit Adventure', desc: 'Point Lenana trek with acclimatization stops and scenic camps', dest: 'Kenya', type: 'TRAVELER' },
    { title: 'Kenya Coast: Diani & Watamu', desc: 'Sun, sand, and snorkeling along the Kenyan coast', dest: 'Kenya', type: 'HOTEL_RESORT' },
    { title: 'Big Five Photo Safari', desc: 'Professional wildlife photography tour across Kenyan parks', dest: 'Kenya', type: 'TRAVEL_AGENCY' },
    // ── Tanzania ──────────────────────────
    { title: 'Zanzibar: 7 Days of Paradise', desc: 'Stone Town, Nungwi, Paje, and spice tours', dest: 'Tanzania', type: 'TRAVELER' },
    { title: 'Serengeti & Ngorongoro Combo', desc: 'The great migration and the crater in one week', dest: 'Tanzania', type: 'TRAVEL_AGENCY' },
    { title: 'Kilimanjaro Machame Route', desc: '7-day Machame route summit attempt', dest: 'Tanzania', type: 'TRAVELER' },
    { title: 'Best of Zanzibar — 7 Days', desc: 'Curated beach, culture, and diving package', dest: 'Tanzania', type: 'HOTEL_RESORT' },
    { title: 'Dar es Salaam City & Bagamoyo', desc: 'Urban culture meets historic coast', dest: 'Tanzania', type: 'TRAVELER' },
    // ── South Africa ──────────────────────
    { title: 'Cape Town & Garden Route', desc: 'Table Mountain, wine country, whale watching', dest: 'South Africa', type: 'TRAVELER' },
    { title: 'Johannesburg: Art & Culture', desc: 'Maboneng, Soweto, Apartheid Museum and more', dest: 'South Africa', type: 'TRAVELER' },
    { title: 'Kruger National Park: 5 Days', desc: 'Self-drive safari through the Big 5 territory', dest: 'South Africa', type: 'TRAVEL_AGENCY' },
    { title: 'Durban Beach Life', desc: 'Surfing, bunny chow, and the Golden Mile', dest: 'South Africa', type: 'TRAVELER' },
    // ── Morocco ───────────────────────────
    { title: 'Marrakech to Sahara — 4 Days', desc: 'Medinas, Atlas Mountains, and desert camping', dest: 'Morocco', type: 'TRAVEL_AGENCY' },
    { title: 'Fez & Chefchaouen Blue City', desc: 'The most photogenic corners of Morocco', dest: 'Morocco', type: 'TRAVELER' },
    { title: 'Morocco Food & Riad Experience', desc: 'Tagines, mint tea, and sleeping in traditional riads', dest: 'Morocco', type: 'HOTEL_RESORT' },
    // ── Egypt ─────────────────────────────
    { title: 'Cairo & Luxor — Ancient Egypt', desc: 'Pyramids, Valley of the Kings, Karnak Temple', dest: 'Egypt', type: 'TRAVELER' },
    { title: 'Nile River Cruise: 5 Nights', desc: 'Luxury cruise from Luxor to Aswan', dest: 'Egypt', type: 'TRAVEL_AGENCY' },
    { title: 'Red Sea Diving Adventure', desc: 'World-class dive sites in Hurghada and Sharm el-Sheikh', dest: 'Egypt', type: 'TRAVELER' },
    // ── Thailand ──────────────────────────
    { title: 'Bangkok to Chiang Mai', desc: 'Temples, night markets, and elephant sanctuaries', dest: 'Thailand', type: 'TRAVELER' },
    { title: 'Thai Island Hopping: Phi Phi & Krabi', desc: 'Crystal clear water and limestone cliffs', dest: 'Thailand', type: 'TRAVELER' },
    { title: 'Thailand Wellness Retreat', desc: 'Yoga, meditation, and Thai massage across 10 days', dest: 'Thailand', type: 'HOTEL_RESORT' },
    // ── Japan ─────────────────────────────
    { title: 'Tokyo & Kyoto Culture Trip', desc: 'Shibuya, temples, cherry blossoms, and sushi', dest: 'Japan', type: 'TRAVELER' },
    { title: 'Japan Rail Pass Adventure', desc: '14 days by bullet train through Osaka, Hiroshima, Hokkaido', dest: 'Japan', type: 'TRAVELER' },
    // ── Italy ─────────────────────────────
    { title: 'Amalfi Coast Dream Trip', desc: 'Positano, Ravello, Capri, and lemon groves', dest: 'Italy', type: 'TRAVELER' },
    { title: 'Rome & Florence — Art & Food', desc: 'Colosseum, Uffizi, pasta-making classes', dest: 'Italy', type: 'TRAVELER' },
    { title: 'Tuscany Wine & Villa Package', desc: 'Stay in a restored 16th-century villa with private tastings', dest: 'Italy', type: 'HOTEL_RESORT' },
    // ── Bali ──────────────────────────────
    { title: 'Bali: Ubud & Uluwatu', desc: 'Rice terraces, temples, and sunset cliff views', dest: 'Indonesia', type: 'TRAVELER' },
    { title: 'Bali Digital Nomad Guide', desc: 'Best cafes, co-working spaces, and villas for remote workers', dest: 'Indonesia', type: 'TRAVELER' },
    { title: 'Bali Luxury Retreat — 5 Nights', desc: 'Private villa with infinity pool and spa treatments', dest: 'Indonesia', type: 'HOTEL_RESORT' },
    // ── Peru ──────────────────────────────
    { title: 'Machu Picchu & Sacred Valley', desc: 'Inca Trail, Cusco markets, and altitude acclimatization', dest: 'Peru', type: 'TRAVELER' },
    { title: 'Peru Food Tour: Lima to Cusco', desc: 'Ceviche, anticuchos, and Pisco sour crawl', dest: 'Peru', type: 'TRAVEL_AGENCY' },
    // ── Greece ────────────────────────────
    { title: 'Santorini & Mykonos Island Hop', desc: 'Blue domes, sunsets, and beach clubs', dest: 'Greece', type: 'TRAVELER' },
    { title: 'Athens & Crete Heritage Tour', desc: 'Acropolis, Knossos Palace, and Mediterranean flavors', dest: 'Greece', type: 'TRAVEL_AGENCY' },
    // ── Dubai ─────────────────────────────
    { title: 'Dubai Luxury Weekend', desc: 'Burj Khalifa, desert safari, and brunch at Atlantis', dest: 'UAE', type: 'TRAVELER' },
    { title: 'Dubai & Abu Dhabi — 5 Days', desc: 'Futuristic architecture, souks, and Sheikh Zayed Mosque', dest: 'UAE', type: 'TRAVEL_AGENCY' },
    // ── Maldives ──────────────────────────
    { title: 'Maldives Overwater Villa 2026', desc: 'Ultimate luxury honeymoon destination', dest: 'Maldives', type: 'HOTEL_RESORT' },
    { title: 'Maldives on a Budget', desc: 'Guest houses, local islands, and ferry tips', dest: 'Maldives', type: 'TRAVELER' },
    // ── Portugal ──────────────────────────
    { title: 'Lisbon & Porto — 10 Days', desc: 'Pastel de nata, port wine, and fado music', dest: 'Portugal', type: 'TRAVELER' },
    { title: 'Algarve Coastal Road Trip', desc: 'Cliffs, caves, and hidden beaches', dest: 'Portugal', type: 'TRAVELER' },
    // ── Rwanda ────────────────────────────
    { title: 'Rwanda Gorilla Trekking', desc: 'Volcanoes National Park — up close with mountain gorillas', dest: 'Rwanda', type: 'TRAVEL_AGENCY' },
    { title: 'Kigali City & Lake Kivu', desc: 'Africa\'s cleanest city and lakeside relaxation', dest: 'Rwanda', type: 'TRAVELER' },
    // ── Mexico ────────────────────────────
    { title: 'Mexico City & Oaxaca Foodie Trip', desc: 'Tacos al pastor, mezcal, and markets', dest: 'Mexico', type: 'TRAVELER' },
    { title: 'Yucatan: Cenotes & Ruins', desc: 'Chichen Itza, Tulum, and swimming in cenotes', dest: 'Mexico', type: 'TRAVELER' },
    // ── Iceland ───────────────────────────
    { title: 'Iceland Ring Road — 10 Days', desc: 'Glaciers, waterfalls, hot springs, and Northern Lights', dest: 'Iceland', type: 'TRAVELER' },
    // ── Ethiopia ──────────────────────────
    { title: 'Lalibela & Simien Mountains', desc: 'Rock-hewn churches and dramatic mountain trekking', dest: 'Ethiopia', type: 'TRAVELER' },
    { title: 'Ethiopian Coffee Origin Trail', desc: 'Visit the birthplace of coffee — Jimma, Sidamo, Yirgacheffe', dest: 'Ethiopia', type: 'TRAVEL_AGENCY' },
    // ── Uganda ────────────────────────────
    { title: 'Uganda: Gorillas & White Water', desc: 'Bwindi Impenetrable Forest and Jinja rafting', dest: 'Uganda', type: 'TRAVEL_AGENCY' },
    // ── Vietnam ───────────────────────────
    { title: 'Vietnam: Hanoi to Ho Chi Minh', desc: 'Ha Long Bay, Hoi An, and street food paradise', dest: 'Vietnam', type: 'TRAVELER' },
    // ── Colombia ──────────────────────────
    { title: 'Cartagena & Medellín — 7 Days', desc: 'Old town, salsa, and cable cars over the Andes', dest: 'Colombia', type: 'TRAVELER' },
    // ── Sri Lanka ─────────────────────────
    { title: 'Sri Lanka Circular Tour', desc: 'Sigiriya, Kandy, Ella train, and southern beaches', dest: 'Sri Lanka', type: 'TRAVEL_AGENCY' },
    // ── Mauritius ─────────────────────────
    { title: 'Mauritius Beach & Culture', desc: 'Seven-colored earth, rum, and turquoise lagoons', dest: 'Mauritius', type: 'HOTEL_RESORT' },
];

async function seed() {
    console.log('🌱 Seeding trip boards...');

    // Get or create a system user to own these boards
    let systemUser = await prisma.user.findFirst({
        where: { email: 'boards@travelpod.com' },
    });

    if (!systemUser) {
        const bcrypt = require('bcryptjs');
        systemUser = await prisma.user.create({
            data: {
                email: 'boards@travelpod.com',
                hashedPassword: await bcrypt.hash('TravelPodBoards2026!', 12),
                accountType: 'TRAVEL_AGENCY',
                onboardingComplete: true,
                emailVerified: true,
            },
        });
        await prisma.profile.create({
            data: {
                userId: systemUser.id,
                displayName: 'Travelpod Curated',
                handle: 'travelpod-curated',
                bio: 'Official curated boards by the Travelpod team',
            },
        });
        console.log('  Created system user: boards@travelpod.com');
    }

    // Also grab any existing business users for variety
    const businessUsers = await prisma.user.findMany({
        where: { accountType: { in: ['TRAVEL_AGENCY', 'HOTEL_RESORT', 'DESTINATION', 'AIRLINE'] } },
        take: 10,
        select: { id: true, accountType: true },
    });

    const travelerUsers = await prisma.user.findMany({
        where: { accountType: 'TRAVELER' },
        take: 10,
        select: { id: true },
    });

    let created = 0;
    for (const b of BOARDS) {
        // Pick an owner: for business boards pick a business user, for traveler boards pick a traveler
        let ownerId = systemUser.id;
        if (b.type === 'TRAVELER' && travelerUsers.length > 0) {
            ownerId = travelerUsers[created % travelerUsers.length].id;
        } else if (b.type !== 'TRAVELER' && businessUsers.length > 0) {
            ownerId = businessUsers[created % businessUsers.length].id;
        }

        // Random engagement
        const likeCount = Math.floor(Math.random() * 200);
        const saveCount = Math.floor(Math.random() * 80);
        const followerCount = Math.floor(Math.random() * 50);

        // Avoid duplicate boards
        const existing = await prisma.tripBoard.findFirst({
            where: { title: b.title, userId: ownerId },
        });
        if (existing) continue;

        await prisma.tripBoard.create({
            data: {
                userId: ownerId,
                title: b.title,
                description: b.desc,
                destination: b.dest,
                isPublic: true,
                likeCount,
                saveCount,
                followerCount,
            },
        });
        created++;
    }

    console.log(`✅ Seeded ${created} trip boards (${BOARDS.length} total defined)`);
    await prisma.$disconnect();
}

seed().catch(e => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
});
