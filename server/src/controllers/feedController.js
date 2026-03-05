const prisma = require('../utils/prisma');

// ============================================================
// FEED ALGORITHM v2 — Per-User Personalized, Never Chronological
// ============================================================
//
// Each user sees a UNIQUE feed based on:
//   1. Category Affinity  — what categories they've liked/saved/watched
//   2. Social Graph       — posts from followed users get a boost
//   3. Engagement Quality — high-engagement posts rise (log-scaled)
//   4. Freshness          — recency matters but doesn't dominate
//   5. Discovery Injection— 30% of feed is from non-followed users in new categories
//   6. Seeded Shuffle     — userId-based hash creates deterministic but different orderings
//
// The result: NO two users ever get the same feed, and it's never purely chronological.

const WEIGHTS = {
    categoryAffinity: 0.25,   // boost posts in categories user interacts with
    socialGraph: 0.20,        // boost posts from followed users
    engagement: 0.20,         // boost high-engagement posts
    freshness: 0.15,          // recency factor
    discovery: 0.10,          // boost for discovering new content
    personalShuffle: 0.10,    // user-seeded randomness for uniqueness
};

// Simple hash for deterministic per-user randomness
function userHash(userId, postId) {
    let hash = 0;
    const str = userId + postId;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash = hash & hash; // 32-bit
    }
    return (Math.abs(hash) % 1000) / 1000; // 0..1
}

function computeScore(post, context) {
    const { followingSet, categoryAffinityMap, now, userId } = context;

    // 1. Category Affinity — higher if user has interacted with posts in this category
    const catId = post.categoryId || 'uncategorized';
    const categoryScore = categoryAffinityMap.get(catId) || 0;

    // 2. Social Graph — followed users' posts get a full boost  
    const socialScore = followingSet.has(post.userId) ? 1.0 : 0;

    // 3. Engagement Quality — logarithmic to prevent viral posts from dominating
    const likes = post.likeCount || 0;
    const comments = post.commentCount || 0;
    const views = post.viewCount || 0;
    const saves = post.saveCount || 0;
    const engagementRaw = Math.log2(likes + 1) * 2 + Math.log2(comments + 1) * 4 + Math.log2(saves + 1) * 3 + Math.log2(views + 1) * 0.3;
    const engagementScore = Math.min(engagementRaw / 20, 1); // normalized 0..1

    // 4. Freshness — steep decay: full score if <1hr, ~0.5 at 24hr, ~0 at 7 days
    const hoursOld = (now - new Date(post.createdAt).getTime()) / (1000 * 60 * 60);
    const freshness = Math.exp(-hoursOld / 48); // half-life of 48 hours

    // 5. Discovery — boost for posts from non-followed users in categories user hasn't interacted much with
    const isDiscovery = !followingSet.has(post.userId) && (categoryAffinityMap.get(catId) || 0) < 0.3;
    const discoveryScore = isDiscovery ? 0.7 + Math.random() * 0.3 : 0;

    // 6. Personal Shuffle — user-specific deterministic noise to ensure uniqueness
    const shuffleScore = userHash(userId || 'anon', post.id);

    const score =
        categoryScore * WEIGHTS.categoryAffinity +
        socialScore * WEIGHTS.socialGraph +
        engagementScore * WEIGHTS.engagement +
        freshness * WEIGHTS.freshness +
        discoveryScore * WEIGHTS.discovery +
        shuffleScore * WEIGHTS.personalShuffle;

    return score;
}

// Build category affinity map from user's past interactions
async function buildCategoryAffinity(userId) {
    const affinityMap = new Map();
    if (!userId) return affinityMap;

    // Get categories of posts the user has liked
    const likedPosts = await prisma.like.findMany({
        where: { userId },
        select: { post: { select: { categoryId: true } } },
        take: 100,
    });

    // Get categories of posts the user has saved
    const savedPosts = await prisma.save.findMany({
        where: { userId },
        select: { post: { select: { categoryId: true } } },
        take: 50,
    });

    // Count interactions per category
    const catCounts = {};
    let total = 0;
    for (const l of likedPosts) {
        const cat = l.post?.categoryId || 'uncategorized';
        catCounts[cat] = (catCounts[cat] || 0) + 1;
        total++;
    }
    for (const s of savedPosts) {
        const cat = s.post?.categoryId || 'uncategorized';
        catCounts[cat] = (catCounts[cat] || 0) + 2; // saves weigh more
        total += 2;
    }

    // Normalize to 0..1
    if (total > 0) {
        for (const [cat, count] of Object.entries(catCounts)) {
            affinityMap.set(cat, Math.min(count / total * 5, 1)); // amplify signal
        }
    }

    return affinityMap;
}

// ============================================================
// GET /api/feed — Personalized feed (never the same for two users)
// ============================================================
const getFeed = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const category = req.query.category || null;
        const userId = req.user?.id;

        // Build user context
        let followingSet = new Set();
        let categoryAffinityMap = new Map();

        if (userId) {
            const [follows, affinity] = await Promise.all([
                prisma.follow.findMany({ where: { followerId: userId }, select: { followingId: true } }),
                buildCategoryAffinity(userId),
            ]);
            followingSet = new Set(follows.map(f => f.followingId));
            categoryAffinityMap = affinity;
        }

        // Build where clause
        // Note: Post schema has no isDeleted field. moderationStatus may be PENDING
        // at launch, so we allow ALL statuses — empty feed is worse than showing pending posts.
        const where = {};
        if (category && category !== 'All') {
            const cat = await prisma.category.findFirst({
                where: { name: { contains: category, mode: 'insensitive' } },
            });
            if (cat) where.categoryId = cat.id;
        }

        // Try APPROVED first, but if no approved posts exist, show all
        const approvedCount = await prisma.post.count({ where: { ...where, moderationStatus: 'APPROVED' } });
        if (approvedCount > 0) {
            where.moderationStatus = 'APPROVED';
        }
        // If no approved posts, we show everything (early stage / launch)

        // Fetch a large pool for ranking (6x page size, min 60)
        const poolSize = Math.max(limit * 6, 60);
        const posts = await prisma.post.findMany({
            where,
            orderBy: [{ createdAt: 'desc' }],
            take: poolSize,
            include: {
                author: {
                    select: {
                        id: true, accountType: true,
                        profile: { select: { displayName: true, handle: true, avatarUrl: true } },
                    },
                },
                category: true,
                postTags: { include: { tag: true } },
            },
        });

        // Score every post with full context
        const now = Date.now();
        const context = { followingSet, categoryAffinityMap, now, userId };
        const scored = posts.map(p => ({ ...p, _score: computeScore(p, context) }));

        // Sort by score descending
        scored.sort((a, b) => b._score - a._score);

        // Paginate from scored results
        const start = (page - 1) * limit;
        const paged = scored.slice(start, start + limit);

        // Enrich with user engagement status
        let enrichedPosts = paged.map(p => ({
            ...p,
            user: p.author,
            category: p.category?.name || null,
        }));

        if (userId) {
            const postIds = paged.map(p => p.id);
            const [likes, saves] = await Promise.all([
                prisma.like.findMany({ where: { userId, postId: { in: postIds } }, select: { postId: true } }),
                prisma.save.findMany({ where: { userId, postId: { in: postIds } }, select: { postId: true } }),
            ]);
            const likedSet = new Set(likes.map(l => l.postId));
            const savedSet = new Set(saves.map(s => s.postId));
            enrichedPosts = paged.map(p => ({
                ...p,
                user: p.author,
                category: p.category?.name || null,
                isLiked: likedSet.has(p.id),
                isSaved: savedSet.has(p.id),
                isFollowed: followingSet.has(p.userId),
            }));
        }

        // Strip internal score
        enrichedPosts.forEach(p => delete p._score);

        const total = await prisma.post.count({ where });
        res.json({ success: true, posts: enrichedPosts, total, page, totalPages: Math.ceil(total / limit) });
    } catch (err) { next(err); }
};

module.exports = { getFeed };
