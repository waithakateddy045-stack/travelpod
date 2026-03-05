const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const PEXELS_API_KEY = '2RGoAaVdwii6DlKTOlrg1xgaXSKFTjhI21kz5dlWFsFOVqOGaEKXc5lU';

const delay = ms => new Promise(res => setTimeout(res, ms));

async function fetchVideoMeta(id) {
    const response = await fetch(`https://api.pexels.com/videos/videos/${id}`, {
        headers: { 'Authorization': PEXELS_API_KEY }
    });
    if (!response.ok) {
        if (response.status === 429) {
            console.log('  ⚠️ Rate limited. Waiting 5s...');
            await delay(5000);
            return fetchVideoMeta(id);
        }
        return null;
    }
    return response.json();
}

async function optimizeVideoUrls() {
    console.log('🚀 Checking database for 4K/UHD videos to downscale to 540p/720p...');

    // Get all distinct video URLs currently in use that look like massive files
    // Since we used video-urls.json, let's just grab all posts that have "pexels" in the URL
    // so we optimise everything currently rendering in the app.
    const allPosts = await prisma.post.findMany({
        where: { videoUrl: { contains: 'pexels' } },
        select: { id: true, videoUrl: true }
    });

    console.log(`📋 Found ${allPosts.length} posts with Pexels URLs. Mapping source IDs...`);

    // Pexels video URLs usually contain the ID in the path: /video-files/123456/...
    const postsToUpdate = allPosts.map(p => {
        const match = p.videoUrl.match(/\/video-files\/(\d+)\//);
        return {
            id: p.id,
            pexelsId: match ? match[1] : null,
            currentUrl: p.videoUrl
        };
    }).filter(p => p.pexelsId);

    // Group by pexelsId so we only hit the API once per unique video
    const uniquePexelsIds = [...new Set(postsToUpdate.map(p => p.pexelsId))];
    console.log(`🎯 Found ${uniquePexelsIds.length} UNIQUE Pexels videos. Beginning API fetch...`);

    let updatedCount = 0;
    const cache = {}; // Store { pexelsId: "optimizedUrl" }

    for (let i = 0; i < uniquePexelsIds.length; i++) {
        const pid = uniquePexelsIds[i];

        try {
            const data = await fetchVideoMeta(pid);
            if (data && data.video_files) {
                // Find SD/HD files, prefer something close to 540 width (mobile portrait/feed standard)
                // Filter for mp4s
                const mp4s = data.video_files.filter(f => f.file_type === 'video/mp4');

                // Sort by how close width is to 540
                mp4s.sort((a, b) => Math.abs(a.width - 540) - Math.abs(b.width - 540));

                if (mp4s.length > 0) {
                    const best = mp4s[0];
                    cache[pid] = best.link; // Cache the ~540p lightweight URL
                }
            }
        } catch (err) {
            console.error(`❌ Error fetching ${pid}:`, err.message);
        }

        // Delay 200ms between calls to avoid hitting rate limits too quickly
        await delay(200);

        if ((i + 1) % 50 === 0) {
            console.log(`   ⏳ Fetched ${i + 1} / ${uniquePexelsIds.length} video metadata...`);
        }
    }

    console.log(`\n✅ Metadata fetch complete. Updating database posts...`);

    // Update the DB
    for (const post of postsToUpdate) {
        const optimizedUrl = cache[post.pexelsId];
        if (optimizedUrl && optimizedUrl !== post.currentUrl) {
            await prisma.post.update({
                where: { id: post.id },
                data: { videoUrl: optimizedUrl }
            });
            updatedCount++;
        }
    }

    console.log(`🎉 Success! Replaced ${updatedCount} massive 4K/1080p URLs with lightweight 540p/720p streams.`);
    await prisma.$disconnect();
}

optimizeVideoUrls().catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
});
