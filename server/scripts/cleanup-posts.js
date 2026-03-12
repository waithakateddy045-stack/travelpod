const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Checking for remaining archive.org posts...');
    const archivePosts = await prisma.post.findMany({
        where: {
            videoUrl: {
                contains: 'archive.org'
            }
        }
    });

    console.log(`Found ${archivePosts.length} posts still using archive.org.`);
    
    if (archivePosts.length > 0) {
        console.log('Deleting unmigrated archive.org posts...');
        const deleteResult = await prisma.post.deleteMany({
            where: {
                videoUrl: {
                    contains: 'archive.org'
                }
            }
        });
        console.log(`Deleted ${deleteResult.count} posts.`);
    }

    // Now, let's find if we have a mass-duplicated video URL (the fallback)
    // We'll look for any videoUrl used more than 10 times that isn't from the official admin
    console.log('Checking for mass-duplicated fallback videos...');
    const groups = await prisma.post.groupBy({
        by: ['videoUrl'],
        _count: {
            videoUrl: true
        },
        having: {
            videoUrl: {
                _count: {
                    gt: 50
                }
            }
        }
    });

    for (const group of groups) {
        const videoUrl = group.videoUrl;
        const count = group._count.videoUrl;
        if (!videoUrl) continue;

        console.log(`Found duplicated URL: ${videoUrl} (${count} instances)`);
        
        const samplePost = await prisma.post.findFirst({
            where: { videoUrl: videoUrl },
            include: { user: true }
        });

        // Delete if not from official admin (e.g. they were fallbacks for unique user posts)
        if (samplePost && samplePost.user.username !== 'official') {
            console.log(`Likely fallback detected for ${samplePost.user.username}. Deleting all but one instance...`);
            const del = await prisma.post.deleteMany({
                where: { 
                    videoUrl: videoUrl,
                    id: { not: samplePost.id }
                }
            });
            console.log(`Deleted ${del.count} fallback instances.`);
        }
    }

    console.log('Cleanup complete.');
}

main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
