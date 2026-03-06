const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const COMMENTS_POOL = [
    "This place is absolutely stunning! 😍",
    "Adding this to my bucket list right now!",
    "The colors in this video are incredible",
    "I visited here last year, it was life changing",
    "Which time of year is best to visit?",
    "How much did this trip cost approximately?",
    "The wildlife footage is breathtaking 🦁",
    "I need to book this NOW",
    "Perfect content for my travel board!",
    "Following for more travel inspiration ✈️",
    "Wow, I had no idea it looked like this in real life.",
    "Such a beautiful destination 🌍",
    "Can't wait to travel again!",
    "This is exactly the vibe I am looking for."
];

async function run() {
    const targetPosts = await prisma.post.findMany({
        where: { videoUrl: { startsWith: 'https://archive.org' } },
        select: { id: true }
    });

    console.log(`Found ${targetPosts.length} archive posts to seed engagement for.`);
    if (targetPosts.length === 0) return;

    const users = await prisma.user.findMany({ select: { id: true } });
    if (users.length === 0) return;

    let totalLikes = 0, totalComments = 0, totalSaves = 0;

    for (let i = 0; i < targetPosts.length; i++) {
        const post = targetPosts[i];

        let likesCount = Math.floor(Math.random() * 146) + 5; // 5 to 150
        let commentsCount = Math.floor(Math.random() * 21); // 0 to 20
        let savesCount = Math.floor(Math.random() * 51); // 0 to 50

        if (Math.random() < 0.05) {
            likesCount *= 5;
            commentsCount *= 3;
            savesCount *= 4;
        }

        let likers = [...users].sort(() => 0.5 - Math.random()).slice(0, Math.min(likesCount, users.length));
        for (const user of likers) {
            try { await prisma.like.create({ data: { postId: post.id, userId: user.id } }).catch(() => { }); } catch (e) { }
        }

        let savers = [...users].sort(() => 0.5 - Math.random()).slice(0, Math.min(savesCount, users.length));
        for (const user of savers) {
            try { await prisma.save.create({ data: { postId: post.id, userId: user.id } }).catch(() => { }); } catch (e) { }
        }

        for (let j = 0; j < commentsCount; j++) {
            const randomUser = users[Math.floor(Math.random() * users.length)];
            const randomCommentText = COMMENTS_POOL[Math.floor(Math.random() * COMMENTS_POOL.length)];
            try {
                await prisma.comment.create({
                    data: { postId: post.id, userId: randomUser.id, content: randomCommentText }
                }).catch(() => { });
            } catch (e) { }
        }

        await prisma.post.update({
            where: { id: post.id },
            data: {
                likeCount: likers.length,
                commentCount: commentsCount,
                saveCount: savers.length
            }
        });

        totalLikes += likers.length;
        totalComments += commentsCount;
        totalSaves += savers.length;

        if (i > 0 && i % 50 === 0) console.log(`Seeded engagement for ${i} posts...`);
    }

    console.log(`\n✅ Added ${totalLikes} likes, ${totalComments} comments, ${totalSaves} saves.`);
}
run().catch(console.error).finally(() => prisma.$disconnect());
