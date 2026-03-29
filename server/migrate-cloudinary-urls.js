/**
 * migrate-cloudinary-urls.js
 * 
 * If you have "Strict Delivery" enabled in your Cloudinary security settings,
 * public un-signed URLs will throw 401 Unauthorized errors (as seen on the feed).
 * 
 * This script iterates through all existing posts and users to regenerate 
 * their media URLs as SIGNED URLs using your Cloudinary API key and secret.
 * 
 * Run this by running:
 * cd server
 * node migrate-cloudinary-urls.js
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const cloudinary = require('cloudinary').v2;
const prisma = new PrismaClient();

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

if (ACCOUNTS.length === 0) {
    console.error("❌ No Cloudinary configurations found in .env");
    process.exit(1);
}

// Function to get the right instance of Cloudinary based on cloud name in the URL
function getCloudinaryInstanceForUrl(url) {
    if (!url || !url.includes('cloudinary.com')) return null;
    
    const match = url.match(/res\.cloudinary\.com\/([^\/]+)\//);
    const urlCloudName = match ? match[1] : null;

    const account = ACCOUNTS.find(a => a.cloud_name === urlCloudName) || ACCOUNTS[0];

    cloudinary.config({
        cloud_name: account.cloud_name,
        api_key: account.api_key,
        api_secret: account.api_secret,
    });
    return cloudinary;
}

function extractPublicId(url) {
    if (!url || !url.includes('cloudinary.com')) return null;
    try {
        const parts = url.split('/');
        const uploadIdx = parts.indexOf('upload');
        if (uploadIdx === -1) return null;
        
        let relevantParts = parts.slice(uploadIdx + 1);
        if (relevantParts[0].match(/^v\d+$/)) {
            relevantParts.shift();
        }

        const fullPath = relevantParts.join('/');
        const dotIdx = fullPath.lastIndexOf('.');
        if (dotIdx !== -1) {
            return fullPath.substring(0, dotIdx);
        }
        return fullPath;
    } catch (e) {
        return null;
    }
}

async function run() {
    console.log('🔄 Starting Cloudinary URL Migration to Signed URLs...');
    
    const posts = await prisma.post.findMany({
        where: {
            OR: [
                { videoUrl: { contains: 'cloudinary.com' } },
                { thumbnailUrl: { contains: 'cloudinary.com' } },
            ]
        }
    });

    console.log(`\nFound ${posts.length} posts to check/migrate.`);
    let postUpdates = 0;

    for (const post of posts) {
        let updated = false;
        const data = {};

        if (post.videoUrl && post.videoUrl.includes('cloudinary.com') && !post.videoUrl.includes('s--')) {
            const publicId = extractPublicId(post.videoUrl);
            const cld = getCloudinaryInstanceForUrl(post.videoUrl);
            if (publicId && cld) {
                data.videoUrl = cld.url(publicId, {
                    resource_type: 'video',
                    format: 'mp4',
                    sign_url: true
                });
                updated = true;
            }
        }

        if (post.thumbnailUrl && post.thumbnailUrl.includes('cloudinary.com') && !post.thumbnailUrl.includes('s--')) {
            const publicId = extractPublicId(post.thumbnailUrl);
            const cld = getCloudinaryInstanceForUrl(post.thumbnailUrl);
            if (publicId && cld) {
                const offsetMatch = post.thumbnailUrl.match(/so_([\d\.]+)/);
                const offset = offsetMatch ? offsetMatch[1] : 0;
                
                data.thumbnailUrl = cld.url(publicId, {
                    resource_type: 'video',
                    format: 'jpg',
                    sign_url: true,
                    transformation: [
                        { start_offset: offset, width: 720, height: 1280, crop: 'fill', gravity: 'auto' },
                        { quality: 'auto' },
                    ]
                });
                updated = true;
            }
        }

        // Sign Photo Array
        if (post.postType === 'PHOTO' && post.mediaUrls && post.mediaUrls.length > 0) {
            const newMediaUrls = post.mediaUrls.map(url => {
                if (url.includes('cloudinary.com') && !url.includes('s--')) {
                    const publicId = extractPublicId(url);
                    const cld = getCloudinaryInstanceForUrl(url);
                    if (publicId && cld) {
                        return cld.url(publicId, {
                            resource_type: 'image',
                            sign_url: true
                        });
                    }
                }
                return url;
            });
            
            // Check if any array elements changed
            if (JSON.stringify(newMediaUrls) !== JSON.stringify(post.mediaUrls)) {
                data.mediaUrls = newMediaUrls;
                updated = true;
            }
        }

        if (updated) {
            await prisma.post.update({
                where: { id: post.id },
                data
            });
            postUpdates++;
        }
    }

    console.log(`✅ Migrated ${postUpdates} posts to Signed URLs.`);
    
    // 2. Migrate User Avatars
    const users = await prisma.user.findMany({
        where: { avatarUrl: { contains: 'cloudinary.com' } }
    });
    
    console.log(`\nFound ${users.length} users to check for avatar migration.`);
    let profileUpdates = 0;
    
    for (const user of users) {
        if (user.avatarUrl && user.avatarUrl.includes('cloudinary.com') && !user.avatarUrl.includes('s--')) {
            const publicId = extractPublicId(user.avatarUrl);
            const cld = getCloudinaryInstanceForUrl(user.avatarUrl);
            if (publicId && cld) {
                const signedAvatar = cld.url(publicId, {
                    resource_type: 'image',
                    sign_url: true
                });
                
                await prisma.user.update({
                    where: { id: user.id },
                    data: { avatarUrl: signedAvatar }
                });
                profileUpdates++;
            }
        }
    }
    
    console.log(`✅ Migrated ${profileUpdates} user avatars to Signed URLs.`);
    
    console.log('\n🎉 Migration Complete! You should no longer see 401 Unauthorized errors.');
    await prisma.$disconnect();
}

run().catch(e => {
    console.error('Migration failed:', e);
    prisma.$disconnect();
    process.exit(1);
});
