const fs = require('fs');
const path = require('path');

const PEXELS_API_KEY = '2RGoAaVdwii6DlKTOlrg1xgaXSKFTjhI21kz5dlWFsFOVqOGaEKXc5lU';
const QUERIES = [
    "travel", "safari kenya", "beach tropical", "mountain hiking", "city streets asia",
    "ocean waves", "desert dunes", "waterfall jungle", "snow mountains", "street food market",
    "aerial drone city", "cruise ship ocean", "ancient ruins", "northern lights", "rice fields bali",
    "savanna africa", "paris streets", "tokyo city", "new york skyline", "london bridge",
    "dubai skyline", "maldives resort", "amazon rainforest", "great barrier reef", "machu picchu",
    "serengeti", "santorini greece", "venice italy", "marrakech morocco", "cape town south africa"
];

const PAGES_PER_QUERY = 3;
const RESULTS_PER_PAGE = 80;
const DELAY_MS = 500;
const OUTPUT_FILE = path.join(__dirname, 'video-urls.json');

const delay = ms => new Promise(res => setTimeout(res, ms));

async function fetchFromPexels(url) {
    const response = await fetch(url, {
        headers: {
            'Authorization': PEXELS_API_KEY
        }
    });

    if (!response.ok) {
        if (response.status === 429) {
            console.log('  ⚠️ Rate limited. Waiting 10 seconds...');
            await delay(10000);
            return fetchFromPexels(url); // Retry
        }
        throw new Error(`Pexels API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
}

async function collectVideos() {
    console.log(`🚀 Starting Pexels Video Collection across ${QUERIES.length} queries...`);
    const allVideos = new Map(); // using Map to deduplicate by video ID

    for (const query of QUERIES) {
        console.log(`\n🔍 Searching: "${query}"`);

        for (let page = 1; page <= PAGES_PER_QUERY; page++) {
            try {
                const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=${RESULTS_PER_PAGE}&page=${page}`;
                const data = await fetchFromPexels(url);

                if (!data.videos || data.videos.length === 0) {
                    console.log(`  ℹ️ No more results on page ${page}. Moving to next query.`);
                    break;
                }

                let collectedThisPage = 0;

                for (const video of data.videos) {
                    // Skip if duration < 5 seconds
                    if (video.duration < 5) continue;

                    // Skip if already collected
                    if (allVideos.has(video.id)) continue;

                    // Find best HD mp4 (min 1280px wide)
                    const validFiles = video.video_files.filter(f =>
                        f.file_type === 'video/mp4' &&
                        f.width >= 1280
                    );

                    // Sort by resolution ascending, we want at least 1280, but maybe not massive 4K to save bandwidth, or just take the best
                    validFiles.sort((a, b) => b.width - a.width); // Highest first

                    if (validFiles.length > 0) {
                        const bestFile = validFiles[0];

                        allVideos.set(video.id, {
                            id: video.id,
                            url: bestFile.link,
                            width: bestFile.width,
                            height: bestFile.height,
                            duration: video.duration,
                            thumbnail: video.image,
                            title: `Travel: ${query}`,
                            author: video.user.name,
                            querySource: query
                        });

                        collectedThisPage++;
                    }
                }

                console.log(`  ✅ Page ${page}: Collected ${collectedThisPage} valid HD videos.`);

                await delay(DELAY_MS);
            } catch (error) {
                console.error(`  ❌ Error fetching page ${page} for "${query}":`, error.message);
            }
        }
    }

    const uniqueVideos = Array.from(allVideos.values());
    console.log(`\n🎉 Finished! Collected a total of ${uniqueVideos.length} unique HD videos.`);

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(uniqueVideos, null, 2));
    console.log(`💾 Saved to ${OUTPUT_FILE}`);
}

collectVideos().catch(console.error);
