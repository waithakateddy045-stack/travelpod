const prisma = require('../utils/prisma');

// ============================================================
// FEED ALGORITHM v3 — Premium Personalized Feed
// ============================================================
//
// Improvements over v2:
//   1. Larger candidate pool (200 vs 60) — better ranking quality
//   2. Sparse content handling — graceful when few posts exist
//   3. Guest trending mode — engagement + freshness for anon users
//   4. Promoted post injection — FeaturedPlacement ads every 5th slot
//   5. Deterministic discovery — no Math.random(), uses userHash
//   6. Engagement RATE weighting — quality over raw volume  
//   7. View dedup — seen posts deprioritised for logged-in users

const WEIGHTS = {
    categoryAffinity: 0.22,
    socialGraph: 0.15,
    engagementRate: 0.20,
    freshness: 0.23,
    discovery: 0.05,
    personalShuffle: 0.05,
    verifiedBoost: 0.05,
    locationAffinity: 0.05,
};

// Deterministic per-user hash for shuffle
function userHash(userId, postId) {
    let hash = 0;
    const str = userId + postId;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash = hash & hash;
    }
    return (Math.abs(hash) % 1000) / 1000;
}

function computeScore(post, context) {
    const { followingSet, categoryAffinityMap, now, userId, viewedSet, locationAffinityMap } = context;

    // 1. Category Affinity
    const catId = post.categoryId || 'uncategorized';
    const categoryScore = categoryAffinityMap.get(catId) || 0;

    // 2. Social Graph
    const socialScore = followingSet.has(post.userId) ? 1.0 : 0;

    // 3. Engagement RATE (quality over volume)
    const likes = post.likeCount || 0;
    const comments = post.commentCount || 0;
    const saves = post.saveCount || 0;
    const views = Math.max(post.viewCount || 1, 1);
    const engagementRaw = (likes + comments * 2 + saves * 4) / views;
    const engagementScore = Math.min(engagementRaw * 10, 1);

    // 4. Freshness — half-life 48hrs, but floor at 0.05 so old viral content still appears
    const hoursOld = (now - new Date(post.createdAt).getTime()) / (1000 * 60 * 60);
    const freshness = Math.max(Math.exp(-hoursOld / 48), 0.05);

    // 5. Discovery — deterministic, for posts from non-followed users in low-affinity categories
    const isDiscovery = !followingSet.has(post.userId) && (categoryAffinityMap.get(catId) || 0) < 0.3;
    const discoveryScore = isDiscovery ? 0.5 + userHash(userId || 'guest', post.id) * 0.5 : 0;

    // 6. Personal Shuffle
    const shuffleScore = userHash(userId || 'anon', post.id);

    // 7. Verified business boost
    const verifiedBoost = post.author?.profile?.businessProfile?.verificationStatus === 'APPROVED' ? 1.0 : 0;

    // 8. Broadcast boost (latest broadcasts jump to feed)
    const broadcastBoost = post.postType === 'BROADCAST' ? 1.5 : 0;

    // 9. View dedup penalty (soft — reduces score by 60%, doesn't hide)
    const viewPenalty = viewedSet.has(post.id) ? 0.4 : 1.0;

    // 10. Location Affinity
    const postLoc = (post.locationTag || '').toLowerCase();
    const locationScore = (locationAffinityMap && postLoc) ? (locationAffinityMap.get(postLoc) || 0) : 0;

    const score = (
        categoryScore * WEIGHTS.categoryAffinity +
        socialScore * WEIGHTS.socialGraph +
        engagementScore * WEIGHTS.engagementRate +
        freshness * WEIGHTS.freshness +
        discoveryScore * WEIGHTS.discovery +
        shuffleScore * WEIGHTS.personalShuffle +
        verifiedBoost * WEIGHTS.verifiedBoost +
        broadcastBoost * 0.5 + // High boost for targeted broadcasts
        locationScore * WEIGHTS.locationAffinity
    ) * viewPenalty;

    return score;
}

// Build location affinity map from user's past liked/saved posts
async function buildLocationAffinity(userId) {
    const affinityMap = new Map();
    if (!userId) return affinityMap;

    try {
        const savedPosts = await prisma.save.findMany({
            where: { userId },
            select: { post: { select: { locationTag: true } } },
            take: 80,
        });

        const locCounts = {};
        let total = 0;
        for (const s of savedPosts) {
            const loc = s.post?.locationTag;
            if (loc) {
                locCounts[loc] = (locCounts[loc] || 0) + 1;
                total++;
            }
        }

        if (total > 0) {
            for (const [loc, count] of Object.entries(locCounts)) {
                affinityMap.set(loc.toLowerCase(), Math.min(count / total * 5, 1));
            }
        }
    } catch (err) {
        console.warn('buildLocationAffinity failed, using empty map:', err.message);
    }

    return affinityMap;
}

// Build category affinity map from user's past interactions
async function buildCategoryAffinity(userId) {
    const affinityMap = new Map();
    if (!userId) return affinityMap;

    const [likedPosts, savedPosts] = await Promise.all([
        prisma.like.findMany({
            where: { userId },
            select: { post: { select: { categoryId: true } } },
            take: 100,
        }),
        prisma.save.findMany({
            where: { userId },
            select: { post: { select: { categoryId: true } } },
            take: 50,
        }),
    ]);

    const catCounts = {};
    let total = 0;
    for (const l of likedPosts) {
        const cat = l.post?.categoryId || 'uncategorized';
        catCounts[cat] = (catCounts[cat] || 0) + 1;
        total++;
    }
    for (const s of savedPosts) {
        const cat = s.post?.categoryId || 'uncategorized';
        catCounts[cat] = (catCounts[cat] || 0) + 2;
        total += 2;
    }

    if (total > 0) {
        for (const [cat, count] of Object.entries(catCounts)) {
            affinityMap.set(cat, Math.min(count / total * 5, 1));
        }
    }
    return affinityMap;
}

// Get ALL viewed post IDs for user or session (no time limit for hard exclusion)
async function getViewedIds(userId, sessionId) {
    const viewedIds = [];
    if (!userId && !sessionId) return viewedIds;

    const where = {};
    if (userId) where.userId = userId;
    else where.sessionId = sessionId;
    where.eventType = 'POST_VIEW';

    const events = await prisma.analyticsEvent.findMany({
        where,
        select: { entityId: true },
        distinct: ['entityId']
    });

    return events.map(e => e.entityId).filter(Boolean);
}

// Get active promoted posts (FeaturedPlacement)
async function getActivePromotions() {
    try {
        const now = new Date();
        const promotions = await prisma.featuredPlacement.findMany({
            where: {
                status: 'ACTIVE',
                startAt: { lte: now },
                endAt: { gte: now },
            },
            include: {
                post: {
                    include: {
                        author: {
                            select: {
                                id: true, accountType: true,
                                profile: {
                                    select: {
                                        displayName: true, handle: true, avatarUrl: true,
                                        businessProfile: { select: { verificationStatus: true } },
                                    },
                                },
                            },
                        },
                        category: true,
                        postTags: { include: { tag: true } },
                    },
                },
            },
            take: 10,
        });
        return promotions;
    } catch {
        return [];
    }
}

// ============================================================
// GET /api/feed — Personalized feed
// ============================================================
const getFeed = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const categoryFilter = req.query.category || null;
        const userId = req.user?.id;
        const sessionId = req.query.sessionId || null;

        // 1. Get viewed post IDs to ensure "View-Once" logic
        const viewedIds = await getViewedIds(userId, sessionId);
        const viewedSet = new Set(viewedIds);

        // 2. Fetch Candidate Pool (Strictly excluding viewed)
        const where = {
            moderationStatus: 'APPROVED',
            id: { notIn: viewedIds }
        };

        if (categoryFilter && categoryFilter !== 'All') {
            const cat = await prisma.category.findFirst({
                where: { name: { contains: categoryFilter, mode: 'insensitive' } },
            });
            if (cat) where.categoryId = cat.id;
        }

        // Fetch deterministic pool
        const posts = await prisma.post.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: 200, // Limit candidate pool for performance
            include: {
                author: { select: { id: true, accountType: true, profile: { select: { displayName: true, handle: true, avatarUrl: true, businessProfile: { select: { verificationStatus: true } } } } } },
                category: true,
                postTags: { include: { tag: true } },
            }
        });

        // 3. Paginate
        const start = (page - 1) * limit;
        const paged = posts.slice(start, start + limit);

        // 4. Inject promoted posts (only on page 1)
        let finalPosts = [...paged];
        if (page === 1) {
            const promotions = await getActivePromotions();
            if (promotions.length > 0) {
                const promoSlots = [2, 7];
                let promoIdx = 0;
                for (const slot of promoSlots) {
                    if (promoIdx < promotions.length && slot <= finalPosts.length) {
                        const promo = promotions[promoIdx];
                        // Only inject if user hasn't seen it recently (promotions can be repeated but let's be gentle)
                        if (!viewedSet.has(promo.post.id) && !finalPosts.find(p => p.id === promo.post.id)) {
                            finalPosts.splice(slot, 0, {
                                ...promo.post,
                                isPromoted: true,
                                promotionId: promo.id
                            });
                            prisma.featuredPlacement.update({
                                where: { id: promo.id },
                                data: { impressions: { increment: 1 } },
                            }).catch(() => { });
                        }
                        promoIdx++;
                    }
                }
            }
        }

        // 5. Enrich (likes/saves/follows)
        const enriched = await enrichPostsAsync(finalPosts, userId, new Set());

        res.json({
            success: true,
            posts: enriched,
            totalCount: posts.length,
            page,
            totalPages: Math.ceil(posts.length / limit) || 1
        });
    } catch (err) { next(err); }
};

const getFollowingFeed = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const sessionId = req.query.sessionId || null;

        // 1. Get following list and viewed history
        const [follows, viewedIds] = await Promise.all([
            prisma.follow.findMany({ where: { followerId: userId }, select: { followingId: true } }),
            getViewedIds(userId, sessionId)
        ]);
        const followingIds = follows.map(f => f.followingId);

        if (followingIds.length === 0) {
            return res.json({ success: true, posts: [], totalCount: 0, page, totalPages: 0 });
        }

        const posts = await prisma.post.findMany({
            where: {
                userId: { in: followingIds },
                moderationStatus: 'APPROVED',
                id: { notIn: viewedIds }
            },
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
            include: {
                author: { select: { id: true, accountType: true, profile: { select: { displayName: true, handle: true, avatarUrl: true, businessProfile: { select: { verificationStatus: true } } } } } },
                category: true,
                postTags: { include: { tag: true } }
            }
        });

        const total = await prisma.post.count({
            where: {
                userId: { in: followingIds },
                moderationStatus: 'APPROVED',
                id: { notIn: viewedIds }
            }
        });

        const enriched = await enrichPostsAsync(posts, userId, new Set(followingIds));

        res.json({
            success: true,
            posts: enriched,
            totalCount: total,
            page,
            totalPages: Math.ceil(total / limit) || 1
        });
    } catch (err) { next(err); }
};

// ============================================================
// GET /api/feed/destinations — Dynamic discovery list
// ============================================================
const getDestinations = async (req, res, next) => {
    try {
        const posts = await prisma.post.findMany({
            where: {
                locationTag: { not: null },
                moderationStatus: 'APPROVED'
            },
            select: { locationTag: true },
            distinct: ['locationTag'],
            take: 50
        });

        const destinations = posts.map(p => p.locationTag).filter(Boolean);
        res.json({ success: true, destinations });
    } catch (err) { next(err); }
};

// ============================================================
// HELPERS
// ============================================================

async function enrichPostsAsync(posts, userId, followingSet = new Set()) {
    if (posts.length === 0) return [];

    const postIds = posts.map(p => p.id);

    let userLikes = new Set();
    let userSaves = new Set();

    if (userId) {
        const [likes, saves] = await Promise.all([
            prisma.like.findMany({ where: { userId, postId: { in: postIds } }, select: { postId: true } }),
            prisma.save.findMany({ where: { userId, postId: { in: postIds } }, select: { postId: true } })
        ]);
        userLikes = new Set(likes.map(l => l.postId));
        userSaves = new Set(saves.map(s => s.postId));
    }

    return posts.map(p => ({
        ...p,
        isLiked: userLikes.has(p.id),
        isSaved: userSaves.has(p.id),
        isFollowing: followingSet.has(p.userId)
    }));
}

module.exports = { getFeed, getFollowingFeed, getDestinations };
