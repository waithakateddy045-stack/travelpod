const fs = require('fs');
const path = require('path');
const https = require('https');

const DESTINATION_SEARCHES = [
    "kenya safari wildlife", "serengeti tanzania africa", "bali indonesia travel", "paris france travel",
    "tokyo japan city", "new york city travel", "london england travel", "dubai travel luxury",
    "maldives beach resort", "santorini greece travel", "morocco marrakech", "cape town south africa",
    "machu picchu peru", "amazon rainforest brazil", "great barrier reef australia", "northern lights iceland",
    "venice italy travel", "bangkok thailand", "cairo egypt pyramids", "nairobi kenya city",
    "zanzibar beach", "masai mara kenya", "swiss alps mountains", "hawaii beach ocean",
    "new zealand nature", "india taj mahal", "barcelona spain", "amsterdam netherlands",
    "singapore city", "hong kong skyline"
];

const EXPERIENCE_SEARCHES = [
    "safari game drive animals", "scuba diving underwater ocean", "mountain hiking trekking",
    "street food market asia", "luxury hotel resort pool", "aerial drone city footage",
    "beach sunset tropical", "cultural festival travel", "road trip travel adventure",
    "backpacking travel budget", "cruise ship ocean travel", "camping nature wilderness",
    "surfing beach waves", "ski resort snow mountains", "food travel culinary",
    "wildlife animals nature", "waterfall jungle rainforest", "desert dunes camel",
    "ancient ruins history travel", "travel vlog adventure"
];

const AUDIENCE_SEARCHES = [
    "luxury travel honeymoon", "family vacation travel kids", "solo travel adventure",
    "budget backpacker travel", "business travel city", "eco travel sustainable",
    "adventure extreme sports travel", "wellness spa retreat travel",
    "photography travel landscape", "digital nomad remote work travel"
];

const ALL_QUERIES = [...DESTINATION_SEARCHES, ...EXPERIENCE_SEARCHES, ...AUDIENCE_SEARCHES];

const MIN_VIDEO_GOAL = 1200;
const DELAY_MS = 300;
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
const OUT_FILE = path.join(__dirname, 'archive-videos.json');

const delay = ms => new Promise(res => setTimeout(res, ms));

function fetchJson(url) {
    const options = {
        headers: {
            'User-Agent': 'TravelpodCrawler/1.0 (antigravity; contact: support@travelpod.com)'
        }
    };
    return new Promise((resolve, reject) => {
        https.get(url, options, (res) => {
            if (res.statusCode !== 200) {
                // Ignore 404s
                if (res.statusCode === 404) return resolve(null);

                // Keep it simple, just skip failure redirects to avoid looping
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    let newUrl = res.headers.location;
                    if (!newUrl.startsWith('http')) {
                        newUrl = new URL(newUrl, url).toString();
                    }
                    return fetchJson(newUrl).then(resolve).catch(() => resolve(null));
                }
                res.resume();
                return resolve(null);
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); } catch (e) {
                    resolve(null);
                }
            });
        }).on('error', e => {
            resolve(null);
        });
    });
}

function getCategory(text) {
    text = text.toLowerCase();
    if (/(safari|wildlife|animal|mountain|hiking|trek|camp)/.test(text)) return "Adventure";
    if (/(beach|ocean|island|resort)/.test(text)) return "Leisure";
    if (/(food|culinary|market|restaurant)/.test(text)) return "Culinary";
    if (/(city|urban|skyline|street)/.test(text)) return "City";
    if (/(luxury|spa|resort|hotel)/.test(text)) return "Luxury";
    if (/(culture|festival|temple|history)/.test(text)) return "Cultural";
    return "Travel";
}

const KNOWN_LOCATIONS = [
    "Kenya", "Tanzania", "Bali", "Indonesia", "Paris", "France", "Tokyo", "Japan", "New York", "London",
    "England", "Dubai", "Maldives", "Santorini", "Greece", "Morocco", "Marrakech", "Cape Town", "South Africa",
    "Machu Picchu", "Peru", "Amazon", "Brazil", "Great Barrier Reef", "Australia", "Iceland", "Venice", "Italy",
    "Bangkok", "Thailand", "Cairo", "Egypt", "Nairobi", "Zanzibar", "Masai Mara", "Swiss Alps", "Switzerland",
    "Hawaii", "New Zealand", "India", "Taj Mahal", "Barcelona", "Spain", "Amsterdam", "Netherlands",
    "Singapore", "Hong Kong", "Europe", "Asia", "Africa", "South America", "North America", "Serengeti"
];

function extractLocation(text, fallbackQuery) {
    for (const loc of KNOWN_LOCATIONS) {
        if (new RegExp(`\\b${loc}\\b`, 'i').test(text)) return loc;
    }
    let fallback = fallbackQuery.split(' ').slice(0, 2).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    if (/safari|scuba|mountain|street|luxury|aerial|beach|cultural|road|backpacking/.test(fallback.toLowerCase())) {
        return "Global Destination";
    }
    return fallback;
}

async function run() {
    let results = [];
    let seenIdentifiers = new Set();

    if (fs.existsSync(OUT_FILE)) {
        try {
            results = JSON.parse(fs.readFileSync(OUT_FILE));
            results.forEach(r => {
                let idMatch = r.url.match(/download\/([^\/]+)\//);
                if (idMatch) seenIdentifiers.add(idMatch[1]);
            });
            console.log(`Resuming with ${results.length} existing videos.`);
        } catch (e) { }
    }

    for (const query of ALL_QUERIES) {
        if (results.length >= MIN_VIDEO_GOAL) break;

        console.log(`\nSearching for: "${query}"`);
        for (let page = 1; page <= 3; page++) {
            if (results.length >= MIN_VIDEO_GOAL) break;

            const searchUrl = `https://archive.org/advancedsearch.php?q=mediatype%3Amovies%20AND%20${encodeURIComponent(query)}&output=json&rows=50&page=${page}&fl[]=identifier,title,description,subject,date`;

            const searchRes = await fetchJson(searchUrl);
            if (!searchRes || !searchRes.response || !searchRes.response.docs) {
                continue;
            }

            const docs = searchRes.response.docs;
            if (docs.length === 0) break;

            for (const doc of docs) {
                if (results.length >= MIN_VIDEO_GOAL) break;
                if (seenIdentifiers.has(doc.identifier)) continue;

                await delay(DELAY_MS);

                const metaUrl = `https://archive.org/metadata/${doc.identifier}`;
                const meta = await fetchJson(metaUrl);
                if (!meta || !meta.files) {
                    continue;
                }

                const files = meta.files.filter(f => f.name && f.name.endsWith('.mp4'));
                if (files.length === 0) {
                    continue;
                }

                let bestFile = null;
                for (const f of files) {
                    const size = parseInt(f.size) || 0;
                    if (size > MAX_FILE_SIZE) continue;

                    let duration = 30; // 30 seconds default
                    let durStr = f.length || (meta.metadata && meta.metadata.runtime);
                    if (durStr) {
                        if (String(durStr).includes(':')) {
                            const parts = String(durStr).split(':').map(Number);
                            if (parts.length === 3) duration = parts[0] * 3600 + parts[1] * 60 + parts[2];
                            else if (parts.length === 2) duration = parts[0] * 60 + parts[1];
                        } else {
                            duration = parseFloat(durStr);
                        }
                        if (isNaN(duration)) duration = 30;
                    }

                    // Strict duration checks removed because Internet Archive metadata is often incomplete

                    let isHd = false;
                    if (f.height) {
                        const h = parseInt(f.height);
                        if (h >= 720) isHd = true;
                    } else {
                        const mbSize = size / (1024 * 1024);
                        if (duration > 0 && mbSize / duration > 0.3) isHd = true;
                    }

                    if (!bestFile || isHd) {
                        bestFile = { file: f, isHd, duration };
                    }
                    if (isHd) break;
                }

                if (!bestFile) continue;

                seenIdentifiers.add(doc.identifier);

                const title = doc.title || "Travel Video";
                const descRaw = Array.isArray(doc.description) ? doc.description.join(' ') : (doc.description || "");
                const desc = descRaw.replace(/<[^>]*>?/gm, '').trim(); // Remove HTML tags
                const tagsRaw = Array.isArray(doc.subject) ? doc.subject : (doc.subject ? [doc.subject] : []);
                const tags = tagsRaw.map(t => String(t).toLowerCase());

                const textForCat = [title, desc, ...tags].join(" ");
                const category = getCategory(textForCat);
                const location = extractLocation(textForCat, query);

                let audience = "Travelers";
                if (/luxury/.test(textForCat)) audience = "Luxury Travelers";
                if (/budget|backpack/.test(textForCat)) audience = "Backpackers";
                if (/family|kids/.test(textForCat)) audience = "Families";
                if (/solo/.test(textForCat)) audience = "Solo Travelers";
                if (/adventure|extreme/.test(textForCat)) audience = "Adventure Seekers";

                const url = `https://archive.org/download/${doc.identifier}/${bestFile.file.name}`;
                const thumbnailUrl = `https://archive.org/services/img/${doc.identifier}`;

                results.push({
                    url,
                    title,
                    description: desc.substring(0, 300),
                    location,
                    tags,
                    category,
                    audience,
                    duration: Math.round(bestFile.duration),
                    thumbnailUrl
                });

                process.stdout.write(`\rLoaded ${results.length} videos... (${doc.identifier})`.padEnd(80));

                // Save periodically
                if (results.length % 50 === 0) {
                    fs.writeFileSync(OUT_FILE, JSON.stringify(results, null, 2));
                }
            }
        }
    }

    fs.writeFileSync(OUT_FILE, JSON.stringify(results, null, 2));
    console.log(`\n\n✅ Crawled ${results.length} videos from Internet Archive and saved.`);
}

run().catch(console.error);
