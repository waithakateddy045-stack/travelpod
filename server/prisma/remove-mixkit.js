const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    const res = await prisma.post.deleteMany({
        where: { videoUrl: { contains: 'mixkit.co' } }
    });
    console.log(`Deleted ${res.count} placeholder videos.`);
}

run().catch(console.error).finally(() => prisma.$disconnect());
