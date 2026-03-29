/**
 * migrate-cloudinary-urls.js  (v2 — Race-Safe)
 *
 * Fixes ALL Cloudinary URLs in the database by:
 *  1. Detecting which account each URL belongs to (by cloud_name in the URL)
 *  2. Signing it with THAT account's api_secret
 *
 * This eliminates 401 Unauthorized errors caused by mismatched signatures.
 *
 * Usage:  cd server && node migrate-cloudinary-urls.js
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const cloudinary = require('cloudinary').v2;
const prisma = new PrismaClient();

// ─── Account Registry ────────────────────────────────────────
const ACCOUNTS = [
    {
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
    },
    {
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME_2,
        api_key: process.env.CLOUDINARY_API_KEY_2,
        api_secret: process.env.CLOUDINARY_API_SECRET_2,
    },
    {
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME_3,
        api_key: process.env.CLOUDINARY_API_KEY_3,
        api_secret: process.env.CLOUDINARY_API_SECRET_3,
    },
].filter(a => a.cloud_name && a.api_key && a.api_secret);

console.log(`☁️  Found ${ACCOUNTS.length} Cloudinary account(s):`);
ACCOUNTS.forEach((a, i) => console.log(`   Account ${i + 1}: ${a.cloud_name}`));

if (ACCOUNTS.length === 0) {
    console.error('\n❌ No Cloudinary accounts configured in .env!');
    process.exit(1);
}

// ─── Helpers ─────────────────────────────────────────────────

/** Find the right account for a URL by matching the cloud_name in the URL */
function getAccountForUrl(url) {
    if (!url || !url.includes('cloudinary.com')) return null;
    const match = url.match(/res\.cloudinary\.com\/([^\/]+)\//);
    if (match) {
        const found = ACCOUNTS.find(a => a.cloud_name === match[1]);
        if (found) return found;
    }
    return ACCOUNTS[0]; // fallback
}

/** Extract public_id from a Cloudinary URL (strips version and extension) */
function extractPublicId(url) {
    if (!url || !url.includes('cloudinary.com')) return null;
    try {
        const parts = url.split('/');
        const uploadIdx = parts.indexOf('upload');
        if (uploadIdx === -1) return null;

        let relevantParts = parts.slice(uploadIdx + 1);
        // Remove version string (e.g., v1234567890)
        if (relevantParts[0] && relevantParts[0].match(/^v\d+$/)) {
            relevantParts.shift();
        }
        // Remove transformation strings (e.g., s--xxx--, c_fill, w_720, etc.)
        relevantParts = relevantParts.filter(p => !p.match(/^s--/) && !p.match(/^[a-z]_/));

        const fullPath = relevantParts.join('/');
        const dotIdx = fullPath.lastIndexOf('.');
        return dotIdx !== -1 ? fullPath.substring(0, dotIdx) : fullPath;
    } catch (e) {
        return null;
    }
}

/** Generate a signed URL using explicit credentials (race-safe) */
function makeSignedUrl(publicId, account, options = {}) {
    return cloudinary.url(publicId, {
        cloud_name: account.cloud_name,
        api_key: account.api_key,
        api_secret: account.api_secret,
        sign_url: true,
        ...options,
    });
}

/** Check if a URL already has a valid signature */
function isAlreadySigned(url) {
    if (!url) return false;
    return url.includes('/s--') && url.includes('--/');
}

// ─── Main Migration ──────────────────────────────────────────

async function run() {
    console.log('\n🔄 Starting Cloudinary URL Migration (v2)...\n');

    // ── 1. Posts ──────────────────────────────────────────────
    const posts = await prisma.post.findMany({
        where: {
            OR: [
                { videoUrl: { contains: 'cloudinary.com' } },
                { thumbnailUrl: { contains: 'cloudinary.com' } },
            ]
        }
    });

    console.log(`📦 Found ${posts.length} posts with Cloudinary URLs.`);
    let postUpdates = 0;
    let postSkipped = 0;

    for (const post of posts) {
        const data = {};
        let updated = false;

        // Video URL
        if (post.videoUrl && post.videoUrl.includes('cloudinary.com')) {
            const account = getAccountForUrl(post.videoUrl);
            if (!account) { postSkipped++; continue; }

            const publicId = extractPublicId(post.videoUrl);
            if (publicId) {
                data.videoUrl = makeSignedUrl(publicId, account, {
                    resource_type: 'video',
                    format: 'mp4',
                });
                updated = true;
            }
        }

        // Thumbnail URL
        if (post.thumbnailUrl && post.thumbnailUrl.includes('cloudinary.com')) {
            const account = getAccountForUrl(post.thumbnailUrl);
            if (account) {
                const publicId = extractPublicId(post.thumbnailUrl);
                if (publicId) {
                    // Check if it's a video thumbnail with transformation params
                    const offsetMatch = post.thumbnailUrl.match(/so_([\d.]+)/);
                    const offset = offsetMatch ? offsetMatch[1] : '0';

                    data.thumbnailUrl = makeSignedUrl(publicId, account, {
                        resource_type: 'video',
                        format: 'jpg',
                        transformation: [
                            { start_offset: offset, width: 720, height: 1280, crop: 'fill', gravity: 'auto' },
                            { quality: 'auto' },
                        ],
                    });
                    updated = true;
                }
            }
        }

        // Media URLs array (photos)
        if (post.mediaUrls && Array.isArray(post.mediaUrls) && post.mediaUrls.length > 0) {
            const newMediaUrls = post.mediaUrls.map(url => {
                if (!url || !url.includes('cloudinary.com')) return url;
                const account = getAccountForUrl(url);
                const publicId = extractPublicId(url);
                if (account && publicId) {
                    return makeSignedUrl(publicId, account, { resource_type: 'image' });
                }
                return url;
            });

            if (JSON.stringify(newMediaUrls) !== JSON.stringify(post.mediaUrls)) {
                data.mediaUrls = newMediaUrls;
                updated = true;
            }
        }

        if (updated) {
            await prisma.post.update({ where: { id: post.id }, data });
            postUpdates++;
        } else {
            postSkipped++;
        }
    }

    console.log(`✅ Posts:    ${postUpdates} migrated, ${postSkipped} skipped.`);

    // ── 2. User Avatars ──────────────────────────────────────
    const users = await prisma.user.findMany({
        where: { avatarUrl: { contains: 'cloudinary.com' } }
    });

    console.log(`\n👤 Found ${users.length} users with Cloudinary avatars.`);
    let avatarUpdates = 0;

    for (const user of users) {
        if (!user.avatarUrl || !user.avatarUrl.includes('cloudinary.com')) continue;

        const account = getAccountForUrl(user.avatarUrl);
        const publicId = extractPublicId(user.avatarUrl);
        if (account && publicId) {
            const signedAvatar = makeSignedUrl(publicId, account, { resource_type: 'image' });
            await prisma.user.update({
                where: { id: user.id },
                data: { avatarUrl: signedAvatar },
            });
            avatarUpdates++;
        }
    }

    console.log(`✅ Avatars:  ${avatarUpdates} migrated.`);

    // ── Summary ──────────────────────────────────────────────
    console.log('\n' + '═'.repeat(50));
    console.log('🎉 Migration Complete!');
    console.log(`   Posts:       ${postUpdates}`);
    console.log(`   Avatars:     ${avatarUpdates}`);
    console.log('═'.repeat(50));

    await prisma.$disconnect();
}

run().catch(e => {
    console.error('\n❌ Migration failed:', e.message);
    prisma.$disconnect();
    process.exit(1);
});
