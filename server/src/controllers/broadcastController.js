const prisma = require('../utils/prisma');
const { AppError } = require('../middleware/errorHandler');
const { uploadVideo, uploadImage, getVideoThumbnail } = require('../services/cloudinary');
const fs = require('fs');

// POST /api/broadcasts — Admin or Association creates a broadcast
const createBroadcast = async (req, res, next) => {
    try {
        const senderType = req.user.accountType;
        const businessTypes = ['TRAVEL_AGENCY', 'HOTEL_RESORT', 'DESTINATION', 'AIRLINE', 'ASSOCIATION'];

        if (!businessTypes.includes(senderType) && senderType !== 'ADMIN') {
            throw new AppError('Only verified businesses and admins can create broadcasts', 403);
        }

        const { title, message, sectorTargeting, region } = req.body;
        if (!title) throw new AppError('Broadcast title is required', 400);

        // Files from multer
        const videoFile = req.files?.video?.[0];
        const imageFiles = req.files?.images || [];

        let videoUrl = null;
        let thumbnailUrl = null;
        let mediaUrls = [];

        try {
            if (videoFile) {
                const { result: bcVideo, accountIndex: videoAccIdx } = await uploadVideo(videoFile.path, { folder: 'travelpod/broadcast/videos' });
                videoUrl = bcVideo.secure_url;
                thumbnailUrl = bcVideo.thumbnail_url || getVideoThumbnail(bcVideo.public_id, 0, videoAccIdx);
            }
            if (imageFiles.length > 0) {
                for (const file of imageFiles) {
                    const { result: bcImg } = await uploadImage(file.path, 'travelpod/broadcast/images');
                    mediaUrls.push(bcImg.secure_url);
                }
            }
        } catch (uploadErr) {
            console.error('Cloudinary upload error:', uploadErr);
            throw new AppError('Media upload failed. Please try again.', 500);
        } finally {
            if (videoFile && fs.existsSync(videoFile.path)) fs.unlinkSync(videoFile.path);
            imageFiles.forEach(f => {
                if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
            });
        }

        if (!message && !videoUrl && mediaUrls.length === 0) {
            throw new AppError('Broadcast must contain at least text, image, or video.', 400);
        }

        const targeting = Array.isArray(sectorTargeting) ? sectorTargeting : (sectorTargeting ? [sectorTargeting] : []);

        const post = await prisma.post.create({
            data: {
                userId: req.user.id,
                title: title.trim(),
                description: message ? message.trim() : '',
                videoUrl: videoUrl || '',
                thumbnailUrl: thumbnailUrl || '',
                mediaUrls: mediaUrls,
                postType: 'BROADCAST',
                isBroadcast: true,
                broadcastSector: targeting.join(','),
                broadcastRegion: region || null,
                moderationStatus: 'APPROVED',
            },
        });

        // Log the action
        await prisma.adminActionLog.create({
            data: {
                adminId: req.user.id,
                actionType: 'CREATE_BROADCAST',
                targetEntityType: 'POST',
                targetEntityId: post.id,
                reason: `Broadcast: ${title}`,
                details: { sectorTargeting, region }
            }
        });

        res.status(201).json({
            success: true,
            broadcast: post,
        });
    } catch (err) { next(err); }
};

const publicUserSelect = {
    id: true,
    username: true,
    displayName: true,
    avatarUrl: true,
    accountType: true,
    isVerified: true,
};

const { getSeenContentIds, markContentSeen } = require('../utils/feedHelper');

// GET /api/broadcasts — List all broadcasts
const getBroadcasts = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;

        const where = { isBroadcast: true };

        const [posts, total] = await Promise.all([
            prisma.post.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    user: { select: publicUserSelect },
                },
            }),
            prisma.post.count({ where }),
        ]);

        res.json({
            success: true,
            broadcasts: posts,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        });
    } catch (err) { next(err); }
};

// GET /api/broadcasts/inbox — Simplified inbox (all broadcasts for now)
const getBroadcastsForUser = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const userId = req.user?.id;

        const { seenPostIds } = await getSeenContentIds(userId);
        const where = { isBroadcast: true, id: { notIn: seenPostIds } };

        // In a real app, filtering by user sector/region would go here
        const [broadcasts, total] = await Promise.all([
            prisma.post.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    user: { select: publicUserSelect },
                },
            }),
            prisma.post.count({ where }),
        ]);

        if (userId && broadcasts.length > 0) {
            markContentSeen(userId, broadcasts.map(b => b.id)).catch(() => {});
        }

        res.json({ success: true, broadcasts, total, page });
    } catch (err) { next(err); }
};

// PUT /api/broadcasts/:id/viewed — Mark as viewed (no-op since BroadcastTarget is missing)
const markBroadcastViewed = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;
        await prisma.post.update({
            where: { id },
            data: { viewCount: { increment: 1 } },
        });
        if (userId) {
            markContentSeen(userId, [id]).catch(() => {});
        }
        res.json({ success: true });
    } catch (err) { next(err); }
};

// GET /api/broadcasts/explore — Discovery feed
const getBroadcastsExplore = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const userId = req.user?.id;

        const { seenPostIds } = await getSeenContentIds(userId);
        const where = { isBroadcast: true, id: { notIn: seenPostIds } };

        const [broadcasts, total] = await Promise.all([
            prisma.post.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    user: { select: publicUserSelect },
                },
            }),
            prisma.post.count({ where }),
        ]);

        if (userId && broadcasts.length > 0) {
            markContentSeen(userId, broadcasts.map(b => b.id)).catch(() => {});
        }

        res.json({ success: true, broadcasts, total, page });
    } catch (err) { next(err); }
};

const deleteBroadcast = async (req, res, next) => {
    try {
        const { id } = req.params;
        await prisma.$transaction([
            prisma.post.delete({ where: { id } }),
            prisma.adminActionLog.create({
                data: {
                    adminId: req.user.id,
                    actionType: 'DELETE_BROADCAST',
                    targetEntityType: 'POST',
                    targetEntityId: id,
                    reason: 'Broadcast deleted by admin'
                }
            })
        ]);
        res.json({ success: true, message: 'Broadcast deleted' });
    } catch (err) { next(err); }
};

module.exports = { createBroadcast, getBroadcasts, getBroadcastsForUser, getBroadcastsExplore, markBroadcastViewed, deleteBroadcast };
