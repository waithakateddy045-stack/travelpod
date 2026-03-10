const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkData() {
    console.log('--- Checking Trip Boards ---');
    const boards = await prisma.tripBoard.findMany({
        where: { isPublic: true },
        include: { 
            user: { select: { id: true, isSuspended: true, isDeleted: true, profile: { select: { handle: true } } } },
            _count: { select: { videos: true } } 
        }
    });
    console.log(`Public Trip Boards found: ${boards.length}`);
    boards.forEach(b => {
        const authorStatus = b.user ? (b.user.isSuspended ? 'Suspended' : (b.user.isDeleted ? 'Deleted' : 'Active')) : 'No Author';
        console.log(`- ${b.title} (ID: ${b.id}, Videos: ${b._count.videos}, Author: @${b.user?.profile?.handle || 'unknown'}, Status: ${authorStatus})`);
    });

    console.log('\n--- Checking Broadcasts ---');
    const broadcasts = await prisma.broadcastPost.findMany({
        include: { post: true }
    });
    console.log(`BroadcastPost records found: ${broadcasts.length}`);
    broadcasts.forEach(b => console.log(`- ${b.post?.title || 'No Title'} (ID: ${b.id}, Post ID: ${b.postId})`));

    const broadcastPosts = await prisma.post.findMany({
        where: { postType: 'BROADCAST' }
    });
    console.log(`\nPosts with postType BROADCAST: ${broadcastPosts.length}`);
    broadcastPosts.forEach(p => console.log(`- ${p.title} (ID: ${p.id}, postType: ${p.postType})`));

    const totalPosts = await prisma.post.count();
    console.log(`\nTotal Posts in DB: ${totalPosts}`);
}

checkData()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
