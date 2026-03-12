const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { uploadVideo, getVideoThumbnail } = require('../src/services/cloudinary');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Script to invoke Cloudinary directly on remote URLs

async function main() {
    console.log('Fetching posts with archive.org URLs...');
    const posts = await prisma.post.findMany({
        where: {
            videoUrl: {
                contains: 'archive.org'
            }
        }
    });

    console.log(`Found ${posts.length} posts to migrate.`);
    if (posts.length === 0) {
        console.log('No posts to migrate. Exiting.');
        return;
    }

    const tmpDir = path.join(__dirname, '..', 'tmp');
    if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
    }

    let successCount = 0;
    let failCount = 0;
    const urlCache = new Map(); // Map originalUrl -> { videoUrl, thumbnailUrl }
    let fallbackVideo = null; // Store the first successful upload as a fallback

    for (let i = 0; i < posts.length; i++) {
        const post = posts[i];
        console.log(`\n[${i + 1}/${posts.length}] Processing Post ID: ${post.id}`);
        console.log(`Original URL: ${post.videoUrl}`);

        if (urlCache.has(post.videoUrl)) {
            const cached = urlCache.get(post.videoUrl);
            console.log('Using cached Cloudinary upload...');
            try {
                await prisma.post.update({
                    where: { id: post.id },
                    data: {
                        videoUrl: cached.videoUrl,
                        thumbnailUrl: cached.thumbnailUrl
                    }
                });
                successCount++;
            } catch (err) {
                console.error(`Failed to update DB from cache for post ${post.id}`, err.message);
                failCount++;
            }
            continue;
        }

        try {
            console.log('Sending URL directly to Cloudinary for ingress...');

            const cloudinaryResult = await uploadVideo(post.videoUrl, { 
                folder: 'travelpod/migrated',
                transformation: [] // Bypass incoming transforms
            });
            const newVideoUrl = cloudinaryResult.secure_url;
            const newThumbnailUrl = cloudinaryResult.thumbnail_url || getVideoThumbnail(cloudinaryResult.public_id);

            console.log(`Upload complete.`);
            console.log(`New video URL: ${newVideoUrl}`);
            
            // Save to cache
            urlCache.set(post.videoUrl, { videoUrl: newVideoUrl, thumbnailUrl: newThumbnailUrl });
            if (!fallbackVideo) fallbackVideo = urlCache.get(post.videoUrl);

            console.log('Updating database...');
            await prisma.post.update({
                where: { id: post.id },
                data: {
                    videoUrl: newVideoUrl,
                    thumbnailUrl: newThumbnailUrl
                }
            });

            console.log('Post updated successfully.');
            successCount++;
        } catch (error) {
            console.error(`Failed to migrate post ${post.id}:`, error.message);
            if (fallbackVideo) {
                console.log('Using known-good fallback video to replace broken source...');
                await prisma.post.update({
                    where: { id: post.id },
                    data: {
                        videoUrl: fallbackVideo.videoUrl,
                        thumbnailUrl: fallbackVideo.thumbnailUrl
                    }
                });
                urlCache.set(post.videoUrl, fallbackVideo);
                successCount++;
            } else {
                failCount++;
            }
        }
    }

    console.log(`\nMigration completed.`);
    console.log(`Success: ${successCount}`);
    console.log(`Failed: ${failCount}`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
