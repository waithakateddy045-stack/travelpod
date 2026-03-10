const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();
const VIDEOS_FILE = path.join(__dirname, 'archive-videos.json');

async function run() {
    if (!fs.existsSync(VIDEOS_FILE)) {
        console.error("No archive-videos.json found.");
        process.exit(1);
    }

    const videos = JSON.parse(fs.readFileSync(VIDEOS_FILE, 'utf8'));
    console.log(`🚀 Starting bulk import of ${videos.length} videos...`);

    // 1. Ensure we have enough users
    let users = await prisma.user.findMany({
        where: { accountType: { not: 'ADMIN' } },
        include: { profile: true }
    });

    if (users.length < 10) {
        console.log("Creating additional creator accounts for diversity...");
        const hashedPw = await bcrypt.hash('Travel1234', 12);
        const creators = [
            { handle: 'globetrotter', name: 'Globe Trotter Agency', type: 'TRAVEL_AGENCY' },
            { handle: 'islandlife', name: 'Island Life Resorts', type: 'HOTEL_RESORT' },
            { handle: 'skytrails', name: 'Sky Trails Airlines', type: 'AIRLINE' },
            { handle: 'urbanexplorer', name: 'Urban Explorer', type: 'TRAVEL_AGENCY' },
            { handle: 'safaripark', name: 'Serengeti Safari', type: 'DESTINATION' },
            { handle: 'vintagetravel', name: 'Vintage Travel Co', type: 'TRAVEL_AGENCY' },
            { handle: 'mountainpeak', name: 'Mountain Peak Lodge', type: 'HOTEL_RESORT' }
        ];

        for (const c of creators) {
            const exists = await prisma.profile.findUnique({ where: { handle: c.handle } });
            if (!exists) {
                const user = await prisma.user.create({
                    data: {
                        email: `${c.handle}@travelpod.test`,
                        hashedPassword: hashedPw,
                        accountType: c.type,
                        onboardingComplete: true,
                        emailVerified: true
                    }
                });
                const profile = await prisma.profile.create({
                    data: {
                        userId: user.id,
                        handle: c.handle,
                        displayName: c.name,
                        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.handle}`,
                        personalityTags: JSON.stringify(['Migration', 'Archive']),
                    }
                });
                await prisma.businessProfile.create({
                    data: {
                        profileId: profile.id,
                        country: 'Global',
                        description: `Official archive account for ${c.name}`,
                        verificationStatus: 'APPROVED'
                    }
                });
                users.push({ ...user, profile });
            }
        }
    }

    // 2. Map categories
    const categoriesDb = await prisma.category.findMany();
    const categoriesMap = {};
    categoriesDb.forEach(c => categoriesMap[c.name.toLowerCase()] = c.id);

    // 3. Import videos
    let createdCount = 0;
    
    for (let i = 0; i < videos.length; i++) {
        const v = videos[i];
        const user = users[i % users.length]; // Distribute evenly
        
        let categoryId = categoriesMap[v.category?.toLowerCase()];
        if (!categoryId) {
            // Create category if missing
            const catName = v.category || 'Travel';
            let cat = await prisma.category.findFirst({ where: { name: catName } });
            if (!cat) {
                cat = await prisma.category.create({ data: { name: catName, slug: catName.toLowerCase().replace(/ /g, '-') } });
                categoriesMap[catName.toLowerCase()] = cat.id;
            }
            categoryId = cat.id;
        }

        try {
            const tagConnections = [];
            if (v.tags && Array.isArray(v.tags)) {
                const seenTags = new Set();
                for (const t of v.tags.slice(0, 5)) {
                    const tagStr = t.trim().substring(0, 30);
                    if (!tagStr || seenTags.has(tagStr)) continue;
                    seenTags.add(tagStr);
                    
                    let tagDb = await prisma.tag.findUnique({ where: { name: tagStr } });
                    if (!tagDb) tagDb = await prisma.tag.create({ data: { name: tagStr } });
                    tagConnections.push({ tagId: tagDb.id });
                }
            }

            await prisma.post.create({
                data: {
                    userId: user.id,
                    videoUrl: v.url,
                    thumbnailUrl: v.thumbnailUrl || '',
                    title: (v.title || 'Untitled Post').substring(0, 100),
                    description: v.description ? v.description.substring(0, 500) : null,
                    locationTag: v.location ? v.location.substring(0, 200) : null,
                    moderationStatus: 'APPROVED',
                    duration: v.duration || 30,
                    categoryId,
                    postTags: { create: tagConnections }
                }
            });
            createdCount++;
            
            if (createdCount % 100 === 0) {
                console.log(`✅ Loaded ${createdCount}/${videos.length} videos...`);
            }
        } catch (err) {
            console.error(`❌ Failed on video ${i}: ${err.message}`);
        }
    }

    console.log(`\n🎉 SUCCESS! Imported ${createdCount} videos across ${users.length} accounts.`);
}

run().catch(console.error).finally(() => prisma.$disconnect());
