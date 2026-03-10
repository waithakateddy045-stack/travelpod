const fs = require('fs');
const path = require('path');
const https = require('https');

const OUT_PATH = path.join(__dirname, '..', 'prisma', 'archive-media.json');

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        https
            .get(url, (res) => {
                if (res.statusCode !== 200) {
                    reject(new Error(`Status ${res.statusCode} for ${url}`));
                    res.resume();
                    return;
                }
                let data = '';
                res.on('data', (chunk) => (data += chunk));
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(e);
                    }
                });
            })
            .on('error', reject);
    });
}

async function fetchArchiveMedia() {
    const base =
        'https://archive.org/advancedsearch.php?q=subject%3A(travel%20OR%20tourism%20OR%20vacation%20OR%20safari%20OR%20beach%20OR%20city%20OR%20nature)%20AND%20year%3A[2020%20TO%202026]&fl[]=identifier&fl[]=title&fl[]=description&fl[]=year&sort[]=downloads+desc&rows=200&page=';

    const items = [];
    let page = 1;

    while (items.length < 1300 && page <= 10) {
        const url = `${base}${page}&output=json`;
        // eslint-disable-next-line no-console
        console.log('Fetching Internet Archive page', page);
        const json = await fetchJson(url);
        const docs = json?.response?.docs || [];
        if (!docs.length) break;

        for (const doc of docs) {
            const id = doc.identifier;
            const title = doc.title || 'Travel clip';
            const description = doc.description || '';
            const year = doc.year || null;

            // Heuristic media URLs; these are common patterns but may need manual pruning later.
            const baseUrl = `https://archive.org/download/${id}/${id}`;
            const videoUrlMp4 = `${baseUrl}.mp4`;
            const imageUrlJpg = `${baseUrl}.jpg`;
            const thumbUrl = `${baseUrl}.jpg`;

            items.push({
                id,
                title,
                description,
                year,
                mediaType: 'unknown',
                videoUrl: videoUrlMp4,
                imageUrl: imageUrlJpg,
                thumbnailUrl: thumbUrl,
            });
        }

        page += 1;
    }

    const unique = [];
    const seen = new Set();
    for (const item of items) {
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        unique.push(item);
    }

    // eslint-disable-next-line no-console
    console.log(`Fetched ${unique.length} unique Internet Archive items.`);
    fs.writeFileSync(OUT_PATH, JSON.stringify(unique, null, 2), 'utf8');
    // eslint-disable-next-line no-console
    console.log('Saved to', OUT_PATH);
}

fetchArchiveMedia().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Failed to fetch archive media', err);
    process.exit(1);
});

