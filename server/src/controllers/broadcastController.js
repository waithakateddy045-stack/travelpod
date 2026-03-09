const prisma = require('../utils/prisma');
const { AppError } = require('../middleware/errorHandler');
const { uploadVideo, uploadImage, getVideoThumbnail } = require('../services/cloudinary');
const fs = require('fs');

// ============================================================
// Broadcast System — Uses BroadcastPost + BroadcastTarget models
// ============================================================

// POST /api/broadcasts — Admin or Association creates a broadcast
const createBroadcast = async (req, res, next) => {
    try {
        const senderType = req.user.accountType;
        const businessTypes = ['TRAVEL_AGENCY', 'HOTEL_RESORT', 'DESTINATION', 'AIRLINE', 'ASSOCIATION'];
        
        if (!businessTypes.includes(senderType) && senderType !== 'ADMIN') {
            throw new AppError('Only verified businesses and admins can create broadcasts', 403);
        }

        // Verified access control for businesses
        if (businessTypes.includes(senderType)) {
            const profile = await prisma.profile.findUnique({
                where: { userId: req.user.id },
                include: { businessProfile: true }
            });
            if (!profile?.businessProfile || profile.businessProfile.verificationStatus !== 'APPROVED') {
                throw new AppError('Your business must be verified to create broadcasts.', 403);
            }
        }

        const { postId, title, message, sectorTargeting, region } = req.body;
        if (!title) throw new AppError('Broadcast title is required', 400);

        // Files from multer
        const videoFile = req.files?.video?.[0];
        const imageFiles = req.files?.images || [];

        let videoUrl = null;
        let thumbnailUrl = null;
        let mediaUrls = [];

        try {
            // 1. Upload video if present
            if (videoFile) {
                const bcVideo = await uploadVideo(videoFile.path, { folder: 'travelpod/broadcast/videos' });
                videoUrl = bcVideo.secure_url;
                thumbnailUrl = bcVideo.thumbnail_url || getVideoThumbnail(bcVideo.public_id);
            }

            // 2. Upload images if present
            if (imageFiles.length > 0) {
                for (const file of imageFiles) {
                    const bcImg = await uploadImage(file.path, 'travelpod/broadcast/images');
                    mediaUrls.push(bcImg.secure_url);
                }
            }
        } catch (uploadErr) {
            console.error('Cloudinary upload error:', uploadErr);
            throw new AppError('Media upload failed. Please try again.', 500);
        } finally {
            // Cleanup local temp files
            if (videoFile && fs.existsSync(videoFile.path)) fs.unlinkSync(videoFile.path);
            imageFiles.forEach(f => {
                if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
            });
        }

        // Calculate media type
        let mediaType = 'TEXT';
        if (videoUrl && mediaUrls.length > 0) mediaType = 'MIXED';
        else if (videoUrl) mediaType = 'VIDEO';
        else if (mediaUrls.length > 0) mediaType = 'IMAGE';

        // Creation must have at least SOME content
        if (!message && !videoUrl && mediaUrls.length === 0) {
            throw new AppError('Broadcast must contain at least text, image, or video.', 400);
        }

        // Create the backing post
        let targetPostId = postId;
        if (!targetPostId) {
            const post = await prisma.post.create({
                data: {
                    userId: req.user.id,
                    title: title.trim(),
                    description: message ? message.trim() : '',
                    videoUrl: videoUrl || '',
                    thumbnailUrl: thumbnailUrl || '',
                    duration: 0,
                    postType: 'BROADCAST',
                    moderationStatus: 'APPROVED',
                },
            });
            targetPostId = post.id;
        }

        const targeting = sectorTargeting ? (typeof sectorTargeting === 'string' ? JSON.parse(sectorTargeting) : sectorTargeting) : [];

        // Create the broadcast post record
        const broadcast = await prisma.broadcastPost.create({
            data: {
                postId: targetPostId,
                senderId: req.user.id,
                sectorTargeting: targeting,
                mediaUrls: mediaUrls,
                mediaType: mediaType,
            },
        });

        // Auto-resolve targets based on sector targeting
        const targetWhere = {};
        if (targeting.length > 0) {
            targetWhere.accountType = { in: targeting };
        }
        if (region) {
            targetWhere.profile = { businessProfile: { country: { contains: region, mode: 'insensitive' } } };
        }

        const targetUsers = await prisma.user.findMany({
            where: {
                ...targetWhere,
                isSuspended: false,
                isDeleted: false,
                id: { not: req.user.id },
            },
            select: { id: true },
            take: 10000,
        });

        // Create broadcast targets in batch
        if (targetUsers.length > 0) {
            await prisma.broadcastTarget.createMany({
                data: targetUsers.map(u => ({
                    broadcastId: broadcast.id,
                    targetUserId: u.id,
                })),
                skipDuplicates: true,
            });

            await prisma.broadcastPost.update({
                where: { id: broadcast.id },
                data: { reachCount: targetUsers.length },
            });
        }

        res.status(201).json({
            success: true,
            broadcast: { ...broadcast, targetCount: targetUsers.length },
        });
    } catch (err) { next(err); }
};

// GET /api/broadcasts — Admin: list all broadcasts with stats
const getBroadcasts = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;

        const [broadcasts, total] = await Promise.all([
            prisma.broadcastPost.findMany({
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    post: {
                        select: { id: true, title: true, description: true, videoUrl: true, thumbnailUrl: true, duration: true, postType: true },
                    },
                    author: {
                        select: {
                            id: true,
                            profile: {
                                select: { displayName: true, handle: true, avatarUrl: true },
                                include: { businessProfile: { select: { verificationStatus: true } } }
                            },
                            businessVerification: true
                        },
                    },
                    _count: { select: { targets: true } },
                },
            }),
            prisma.broadcastPost.count(),
        ]);

        // Enrich with viewed counts
        const enriched = await Promise.all(broadcasts.map(async (b) => {
            const viewedCount = await prisma.broadcastTarget.count({
                where: { broadcastId: b.id, viewed: true },
            });
            return {
                ...b,
                targetCount: b._count.targets,
                viewedCount,
                viewRate: b._count.targets > 0 ? ((viewedCount / b._count.targets) * 100).toFixed(1) : '0',
            };
        }));

        res.json({ success: true, broadcasts: enriched, total, page, totalPages: Math.ceil(total / limit) });
    } catch (err) { next(err); }
};

// GET /api/broadcasts/inbox — User: broadcasts targeted at them
const getBroadcastsForUser = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;

        const targets = await prisma.broadcastTarget.findMany({
            where: { targetUserId: req.user.id },
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
            include: {
                broadcast: {
                    include: {
                        post: {
                            select: { id: true, title: true, description: true, videoUrl: true, thumbnailUrl: true, duration: true, postType: true },
                        },
                        author: {
                            select: {
                                id: true,
                                profile: {
                                    select: { displayName: true, handle: true, avatarUrl: true },
                                    include: {
                                        businessProfile: {
                                            select: { verificationStatus: true, logoUrl: true }
                                        }
                                    }
                                },
                                businessVerification: true
                            },
                        },
                    },
                },
            },
        });

        const broadcasts = targets.map(t => ({
            id: t.broadcast.id,
            post: t.broadcast.post,
            sender: t.broadcast.author,
            mediaUrls: t.broadcast.mediaUrls,
            mediaType: t.broadcast.mediaType,
            viewed: t.viewed,
            delivered: t.delivered,
            targetId: t.id,
            createdAt: t.createdAt,
        }));

        res.json({ success: true, broadcasts, page });
    } catch (err) { next(err); }
};

// PUT /api/broadcasts/:id/viewed — Mark as viewed
const markBroadcastViewed = async (req, res, next) => {
    try {
        const { id } = req.params;

        await prisma.broadcastTarget.updateMany({
            where: {
                broadcastId: id,
                targetUserId: req.user.id,
            },
            data: { viewed: true, delivered: true },
        });

        // Increment view count on the broadcast post
        await prisma.broadcastPost.update({
            where: { id },
            data: { viewCount: { increment: 1 } },
        });

        res.json({ success: true });
    } catch (err) { next(err); }
};

// DELETE /api/admin/broadcasts/:id — Delete a broadcast
const deleteBroadcast = async (req, res, next) => {
    try {
        const { id } = req.params;
        const broadcast = await prisma.broadcastPost.findUnique({ where: { id } });
        if (!broadcast) throw new AppError('Broadcast not found', 404);

        // Delete targets first, then the broadcast
        await prisma.broadcastTarget.deleteMany({ where: { broadcastId: id } });
        await prisma.broadcastPost.delete({ where: { id } });

        res.json({ success: true, message: 'Broadcast deleted' });
    } catch (err) { next(err); }
};

// GET /api/broadcasts/explore — Discovery feed for broadcasts
const getBroadcastsExplore = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const userId = req.user?.id;

        const [broadcasts, total] = await Promise.all([
            prisma.broadcastPost.findMany({
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    post: {
                        select: { id: true, title: true, description: true, videoUrl: true, thumbnailUrl: true, duration: true, postType: true, likeCount: true, viewCount: true },
                    },
                    author: {
                        select: {
                            id: true,
                            profile: {
                                select: { displayName: true, handle: true, avatarUrl: true },
                                include: { businessProfile: { select: { verificationStatus: true } } }
                            },
                        },
                    },
                },
            }),
            prisma.broadcastPost.count(),
        ]);

        // Enrich with engagement status if user is logged in
        let enriched = broadcasts.map(b => ({
            ...b,
            post: {
                ...b.post,
                author: b.author,
                isBroadcast: true,
                broadcastId: b.id
            }
        }));

        if (userId) {
            const postIds = broadcasts.map(b => b.post.id);
            const targets = await prisma.broadcastTarget.findMany({
                where: { targetUserId: userId, broadcastId: { in: broadcasts.map(b => b.id) } },
                select: { broadcastId: true, viewed: true }
            });
            const viewedSet = new Set(targets.filter(t => t.viewed).map(t => t.broadcastId));

            enriched = enriched.map(b => ({
                ...b,
                viewed: viewedSet.has(b.id)
            }));
        }

        res.json({ success: true, broadcasts: enriched, total, page });
    } catch (err) { next(err); }
};

module.exports = { createBroadcast, getBroadcasts, getBroadcastsForUser, getBroadcastsExplore, markBroadcastViewed, deleteBroadcast };
