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
    socialGraph: 0.20,
    engagementRate: 0.18,
    freshness: 0.15,
    discovery: 0.12,
    personalShuffle: 0.08,
    verifiedBoost: 0.05,
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
    const { followingSet, categoryAffinityMap, now, userId, viewedSet } = context;

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
    const engagementRaw = (likes + comments * 2 + saves * 3) / views;
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

    // 8. View dedup penalty (soft — reduces score by 60%, doesn't hide)
    const viewPenalty = viewedSet.has(post.id) ? 0.4 : 1.0;

    const score = (
        categoryScore * WEIGHTS.categoryAffinity +
        socialScore * WEIGHTS.socialGraph +
        engagementScore * WEIGHTS.engagementRate +
        freshness * WEIGHTS.freshness +
        discoveryScore * WEIGHTS.discovery +
        shuffleScore * WEIGHTS.personalShuffle +
        verifiedBoost * WEIGHTS.verifiedBoost
    ) * viewPenalty;

    return score;
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

// Get recently viewed post IDs (last 48hrs)
async function getRecentlyViewed(userId) {
    const viewedSet = new Set();
    if (!userId) return viewedSet;

    try {
        const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
        const events = await prisma.analyticsEvent.findMany({
            where: {
                userId,
                eventType: 'POST_VIEW',
                createdAt: { gte: cutoff },
            },
            select: { entityId: true },
            take: 200,
        });
        for (const e of events) {
            if (e.entityId) viewedSet.add(e.entityId);
        }
    } catch {
        // AnalyticsEvent table may not exist yet — graceful fallback
    }
    return viewedSet;
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
        const category = req.query.category || null;
        const userId = req.user?.id;

        // Build user context in parallel
        const [followsList, categoryAffinityMap, viewedSet] = await Promise.all([
            userId ? prisma.follow.findMany({ where: { followerId: userId }, select: { followingId: true } }) : [],
            buildCategoryAffinity(userId),
            getRecentlyViewed(userId),
        ]);
        const followingSet = new Set(followsList.map(f => f.followingId));

        // Build where clause
        const where = {};
        if (category && category !== 'All') {
            const cat = await prisma.category.findFirst({
                where: { name: { contains: category, mode: 'insensitive' } },
            });
            if (cat) where.categoryId = cat.id;
        }

        // Prefer APPROVED posts, but fallback to all for early-stage
        const approvedCount = await prisma.post.count({ where: { ...where, moderationStatus: 'APPROVED' } });
        if (approvedCount > 0) {
            where.moderationStatus = 'APPROVED';
        }

        // Total available for pagination
        const totalPosts = await prisma.post.count({ where });

        // Sparse content handling: if very few posts, just return them all
        if (totalPosts <= limit) {
            const posts = await prisma.post.findMany({
                where,
                orderBy: [{ createdAt: 'desc' }],
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
            });

            const enriched = enrichPosts(posts, userId, followingSet);
            return res.json({ success: true, posts: enriched, total: totalPosts, page: 1, totalPages: 1 });
        }

        // Large pool for ranking (min 100, max 200)
        const poolSize = Math.min(Math.max(limit * 10, 100), 200);
        const posts = await prisma.post.findMany({
            where,
            orderBy: [{ createdAt: 'desc' }],
            take: poolSize,
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
        });

        // Score and sort
        const now = Date.now();
        const context = { followingSet, categoryAffinityMap, now, userId, viewedSet };
        const scored = posts.map(p => ({ ...p, _score: computeScore(p, context) }));
        scored.sort((a, b) => b._score - a._score);

        // Paginate
        const start = (page - 1) * limit;
        const paged = scored.slice(start, start + limit);

        // Inject promoted posts (1 per 5 organic, positions 2, 7, 12...)
        let finalPosts = [...paged];
        if (page === 1) {
            const promotions = await getActivePromotions();
            if (promotions.length > 0) {
                const promoSlots = [2, 7]; // inject at positions 3 and 8 (0-indexed: 2, 7)
                let promoIdx = 0;
                for (const slot of promoSlots) {
                    if (promoIdx < promotions.length && slot <= finalPosts.length) {
                        const promo = promotions[promoIdx];
                        finalPosts.splice(slot, 0, {
                            ...promo.post,
                            isPromoted: true,
                            promotionId: promo.id,
                            _score: 999,
                        });
                        // Increment impressions
                        prisma.featuredPlacement.update({
                            where: { id: promo.id },
                            data: { impressions: { increment: 1 } },
                        }).catch(() => { }); // fire-and-forget
                        promoIdx++;
                    }
                }
            }
        }

        // Enrich with engagement status
        const enriched = await enrichPostsAsync(finalPosts, userId, followingSet);

        // Strip internal scores
        enriched.forEach(p => { delete p._score; });

        res.json({ success: true, posts: enriched, total: totalPosts, page, totalPages: Math.ceil(totalPosts / limit) });
    } catch (err) { next(err); }
};

// Helper: enrich posts synchronously (for sparse mode)
function enrichPosts(posts, userId, followingSet) {
    return posts.map(p => ({
        ...p,
        user: p.author,
        category: p.category?.name || null,
        isLiked: false,
        isSaved: false,
        isFollowing: followingSet.has(p.userId),
        isPromoted: false,
    }));
}

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

module.exports = { getFeed };
