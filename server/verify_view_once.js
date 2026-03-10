const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verify() {
    try {
        console.log('Starting View-Once Verification...');
        
        // 1. Get a random user
        const user = await prisma.user.findFirst({
            where: { email: { contains: 'travelpod.test' } },
            select: { id: true, email: true }
        });
        if (!user) throw new Error('No test user found');
        console.log(`Testing with user: ${user.email} (${user.id})`);

        // 2. Clear previous views for this user to start clean
        await prisma.analyticsEvent.deleteMany({
            where: { user: { id: user.id }, eventType: 'POST_VIEW' }
        });

        // 3. Mock a request context for feedController
        const getViewedIds = async (userId) => {
            const events = await prisma.analyticsEvent.findMany({
                where: { user: { id: userId }, eventType: 'POST_VIEW' },
                select: { entityId: true },
                distinct: ['entityId']
            });
            return events.map(e => e.entityId).filter(Boolean);
        };

        // 4. Initial pool
        const poolBefore = await prisma.post.findMany({
            where: { moderationStatus: 'APPROVED' },
            take: 10
        });
        const targetPost = poolBefore[0];
        console.log(`Target post to view: ${targetPost.id}`);

        // 5. Create a view event
        await prisma.analyticsEvent.create({
            data: {
                user: { connect: { id: user.id } },
                eventType: 'POST_VIEW',
                entityId: targetPost.id,
                entityType: 'POST',
                createdAt: new Date()
            }
        });
        console.log('POST_VIEW event created.');

        // 6. Verify viewedIds excludes it
        const viewedIds = await getViewedIds(user.id);
        console.log('Viewed IDs:', viewedIds);
        
        const isExcluded = viewedIds.includes(targetPost.id);
        console.log(`Is target post in viewedIds? ${isExcluded}`);

        // 7. Test the "notIn" query
        const poolAfter = await prisma.post.findMany({
            where: {
                moderationStatus: 'APPROVED',
                id: { notIn: viewedIds }
            },
            take: 10
        });

        const stillInFeed = poolAfter.find(p => p.id === targetPost.id);
        if (!stillInFeed) {
            console.log('✅ SUCCESS: Viewed post is excluded from the feed pool.');
        } else {
            console.log('❌ FAILURE: Viewed post is still in the feed pool.');
        }

    } catch (e) {
        console.error('Verification failed:', e);
    } finally {
        await prisma.$disconnect();
    }
}

verify();
