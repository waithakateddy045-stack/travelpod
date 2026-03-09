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

        // Build user context
        const [followsList, categoryAffinityMap, viewedIds, locationAffinityMap] = await Promise.all([
            userId ? prisma.follow.findMany({ where: { followerId: userId }, select: { followingId: true } }) : [],
            buildCategoryAffinity(userId),
            getViewedIds(userId, sessionId),
            buildLocationAffinity(userId),
        ]);
        const followingSet = new Set(followsList.map(f => f.followingId));
        const viewedSet = new Set(viewedIds);

        // 1. Fetch Candidate Pool
        // Instead of strict "notIn", we fetch a large pool of fresh content
        // and a small pool of trending content (even if seen) to ensure feed is NEVER empty.

        const where = { moderationStatus: 'APPROVED' };
        if (categoryFilter && categoryFilter !== 'All') {
            const cat = await prisma.category.findFirst({
                where: { name: { contains: categoryFilter, mode: 'insensitive' } },
            });
            if (cat) where.categoryId = cat.id;
        }

        const [freshPool, qualityPool] = await Promise.all([
            // Fresh pool: Latest posts (limit to 400 for performance)
            prisma.post.findMany({
                where: { ...where, createdAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) } }, // Last 14 days
                orderBy: { createdAt: 'desc' },
                take: 400,
                include: {
                    author: { select: { id: true, accountType: true, profile: { select: { displayName: true, handle: true, avatarUrl: true, businessProfile: { select: { verificationStatus: true } } } } } },
                    category: true,
                    postTags: { include: { tag: true } },
                }
            }),
            // Quality pool: High engagement (limit to 100)
            prisma.post.findMany({
                where,
                orderBy: { likeCount: 'desc' },
                take: 100,
                include: {
                    author: { select: { id: true, accountType: true, profile: { select: { displayName: true, handle: true, avatarUrl: true, businessProfile: { select: { verificationStatus: true } } } } } },
                    category: true,
                    postTags: { include: { tag: true } },
                }
            })
        ]);

        // Merge and unique
        const poolMap = new Map();
        [...freshPool, ...qualityPool].forEach(p => poolMap.set(p.id, p));
        let posts = Array.from(poolMap.values());

        // 2. Score and Sort
        const now = Date.now();
        const context = { followingSet, categoryAffinityMap, now, userId, viewedSet, locationAffinityMap };
        const scored = posts.map(p => ({ ...p, _score: computeScore(p, context) }));

        // Sort by score
        scored.sort((a, b) => b._score - a._score);

        // 3. Paginate
        const start = (page - 1) * limit;
        const paged = scored.slice(start, start + limit);
        let finalPosts = paged.length > 0 ? [...paged] : [];

        if (finalPosts.length === 0 && posts.length > 0) {
            // Exhausted scored pages — provide random quality posts as fallback
            const fallback = posts.sort(() => Math.random() - 0.5).slice(0, limit);
            finalPosts = fallback;
        }

        // 4. Inject promoted posts (1 per 5 organic)
        if (page === 1) {
            const promotions = await getActivePromotions();
            if (promotions.length > 0) {
                const promoSlots = [2, 7];
                let promoIdx = 0;
                for (const slot of promoSlots) {
                    if (promoIdx < promotions.length && slot <= finalPosts.length) {
                        const promo = promotions[promoIdx];
                        if (!finalPosts.find(p => p.id === promo.post.id)) {
                            finalPosts.splice(slot, 0, {
                                ...promo.post,
                                isPromoted: true,
                                promotionId: promo.id,
                                _score: 999,
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

        // 5. Enrich
        const enriched = await enrichPostsAsync(finalPosts, userId, followingSet);
        enriched.forEach(p => { delete p._score; });

        res.json({
            success: true,
            posts: enriched,
            total: posts.length,
            page,
            totalPages: Math.ceil(posts.length / limit) || 1
        });
    } catch (err) { next(err); }
};


// Helper: enrich posts with actual like/save status
async function enrichPostsAsync(posts, userId, followingSet) {
    let enriched = posts.map(p => ({
        ...p,
        user: p.author,
        category: p.category?.name || null,
        isPromoted: p.isPromoted || false,
        promotionId: p.promotionId || null,
    }));

    if (userId) {
        const postIds = posts.map(p => p.id).filter(Boolean);
        const [likes, saves] = await Promise.all([
            prisma.like.findMany({ where: { userId, postId: { in: postIds } } }),
            prisma.save.findMany({ where: { userId, postId: { in: postIds } } }),
        ]);
        const likedSet = new Set(likes.map(l => l.postId));
        const savedSet = new Set(saves.map(s => s.postId));

        enriched = enriched.map(p => ({
            ...p,
            isLiked: likedSet.has(p.id),
            isSaved: savedSet.has(p.id),
            isFollowing: followingSet.has(p.userId),
        }));
    } else {
        enriched = enriched.map(p => ({
            ...p,
            isLiked: false,
            isSaved: false,
            isFollowing: false,
        }));
    }

    return enriched;
}

// GET /api/feed/following — Only posts from users the current user follows
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
        const viewedSet = new Set(viewedIds);

        if (followingIds.length === 0) {
            return res.json({ success: true, posts: [], total: 0, page, totalPages: 0 });
        }

        // 2. Fetch all candidates from following (larger pool for sorting)
        const poolSize = page === 1 ? 500 : limit * 10;
        const posts = await prisma.post.findMany({
            where: {
                userId: { in: followingIds },
                moderationStatus: 'APPROVED'
            },
            orderBy: { createdAt: 'desc' },
            take: poolSize,
            include: {
                author: { select: { id: true, accountType: true, profile: { select: { displayName: true, handle: true, avatarUrl: true, businessProfile: { select: { verificationStatus: true } } } } } },
                category: true,
                postTags: { include: { tag: true } }
            }
        });

        // 3. Score and Sort (Soft Dedupe)
        // For following feed, scoring is mostly Recency + Unseen
        const processed = posts.map(p => {
            let score = new Date(p.createdAt).getTime();
            if (viewedSet.has(p.id)) score -= (1000 * 60 * 60 * 24 * 7); // Penalize by 1 week in time for read posts
            return { ...p, _score: score };
        });
        processed.sort((a, b) => b._score - a._score);

        // 4. Paginate
        const paged = processed.slice((page - 1) * limit, page * limit);
        const enriched = await enrichPostsAsync(paged, userId, new Set(followingIds));

        res.json({
            success: true,
            posts: enriched,
            total: posts.length,
            page,
            totalPages: Math.ceil(posts.length / limit) || 1
        });
    } catch (err) { next(err); }
};

module.exports = { getFeed, getFollowingFeed };
