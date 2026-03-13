const { getSeenContentIds, markContentSeen } = require('../utils/feedHelper');

// ============================================================
// GET /api/feed
// - Guests: all APPROVED posts, createdAt desc, paginated
// - Logged-in: prioritize following, then simple affinity, then trending fallback
// ============================================================
const getFeed = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
    const destination = req.query.destination ? normalizeDestination(req.query.destination) : null;
    const sessionId = req.query.sessionId;

    const where = {
      moderationStatus: 'APPROVED',
      ...(destination && { locationTag: { equals: destination, mode: 'insensitive' } }),
    };

    // Guest feed
    if (!req.user?.id) {
      const [posts, total] = await Promise.all([
        prisma.post.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: { 
            user: { select: publicUserSelect },
            reviewOf: { include: { user: { select: publicUserSelect } } }
          },
        }),
        prisma.post.count({ where }),
      ]);
      const mappedPosts = posts.map(p => ({
        ...p,
        user: p.user ? {
          ...p.user,
          profile: {
            handle: p.user.username,
            displayName: p.user.displayName,
            avatarUrl: p.user.avatarUrl
          }
        } : null
      }));
      return res.json({ success: true, posts: mappedPosts, page, total, totalPages: Math.ceil(total / limit) });
    }

    // Logged-in feed (lightweight PRD-ish ranking)
    const userId = req.user.id;

    // Fetch seen IDs to exclude
    const { seenPostIds } = await getSeenContentIds(userId);
    const excludeSeen = { id: { notIn: seenPostIds } };

    const me = await prisma.user.findUnique({
      where: { id: userId },
      select: { preferredRegions: true },
    });
    const preferred = Array.isArray(me?.preferredRegions)
      ? me.preferredRegions.map((s) => String(s).trim().toLowerCase()).filter(Boolean)
      : [];

    const following = await prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
      take: 1000,
    });
    const followingIds = following.map((f) => f.followingId);

    const [fromFollowing, fromPreferred, trending] = await Promise.all([
      followingIds.length
        ? prisma.post.findMany({
            where: { ...where, ...excludeSeen, userId: { in: followingIds } },
            orderBy: { createdAt: 'desc' },
            take: 80,
            include: { 
              user: { select: publicUserSelect },
              reviewOf: { include: { user: { select: publicUserSelect } } }
            },
          })
        : Promise.resolve([]),
      preferred.length
        ? prisma.post.findMany({
            where: { ...where, ...excludeSeen, locationTag: { in: preferred, mode: 'insensitive' } },
            orderBy: { createdAt: 'desc' },
            take: 80,
            include: { 
              user: { select: publicUserSelect },
              reviewOf: { include: { user: { select: publicUserSelect } } }
            },
          })
        : Promise.resolve([]),
      prisma.post.findMany({
        where: { ...where, ...excludeSeen },
        orderBy: [{ saveCount: 'desc' }, { commentCount: 'desc' }, { likeCount: 'desc' }, { createdAt: 'desc' }],
        take: 120,
        include: { 
          user: { select: publicUserSelect },
          reviewOf: { include: { user: { select: publicUserSelect } } }
        },
      }),
    ]);

    const dedup = new Map();
    for (const p of [...fromFollowing, ...fromPreferred, ...trending]) dedup.set(p.id, p);
    const candidates = Array.from(dedup.values());

    const followSet = new Set(followingIds);
    const sorted = candidates.sort((a, b) => {
      const aFollow = followSet.has(a.userId) ? 1 : 0;
      const bFollow = followSet.has(b.userId) ? 1 : 0;
      if (aFollow !== bFollow) return bFollow - aFollow;

      const aScore = (a.saveCount || 0) * 4 + (a.commentCount || 0) * 2 + (a.likeCount || 0);
      const bScore = (b.saveCount || 0) * 4 + (b.commentCount || 0) * 2 + (b.likeCount || 0);
      if (aScore !== bScore) return bScore - aScore;

      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    const start = (page - 1) * limit;
    const posts = sorted.slice(start, start + limit);

    // Mark as seen in background
    if (posts.length > 0) {
      markContentSeen(userId, posts.map(p => p.id)).catch(() => {});
    }

    const mappedPosts = posts.map(p => ({
      ...p,
      user: p.user ? {
        ...p.user,
        profile: {
          handle: p.user.username,
          displayName: p.user.displayName,
          avatarUrl: p.user.avatarUrl
        }
      } : null
    }));

    res.json({ success: true, posts: mappedPosts, page, total: sorted.length, totalPages: Math.ceil(sorted.length / limit) });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// GET /api/feed/following
// ============================================================
const getFollowingFeed = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);

    const { seenPostIds } = await getSeenContentIds(userId);

    const following = await prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
      take: 1000,
    });
    const ids = following.map((f) => f.followingId);
    if (!ids.length) return res.json({ success: true, posts: [], page, total: 0, totalPages: 0 });

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where: { 
          moderationStatus: 'APPROVED', 
          userId: { in: ids },
          id: { notIn: seenPostIds }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { 
          user: { select: publicUserSelect },
          reviewOf: { include: { user: { select: publicUserSelect } } }
        },
      }),
      prisma.post.count({ 
        where: { 
          moderationStatus: 'APPROVED', 
          userId: { in: ids },
          id: { notIn: seenPostIds }
        } 
      }),
    ]);

    // Mark seen
    if (posts.length > 0) {
      markContentSeen(userId, posts.map(p => p.id)).catch(() => {});
    }

    const mappedPosts = posts.map(p => ({
      ...p,
      user: p.user ? {
        ...p.user,
        profile: {
          handle: p.user.username,
          displayName: p.user.displayName,
          avatarUrl: p.user.avatarUrl
        }
      } : null
    }));

    res.json({ success: true, posts: mappedPosts, page, total, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// GET /api/feed/destinations
// ============================================================
const getDestinations = async (req, res, next) => {
  try {
    const rows = await prisma.post.findMany({
      where: { moderationStatus: 'APPROVED', locationTag: { not: null } },
      select: { locationTag: true },
      distinct: ['locationTag'],
      take: 200,
    });
    const destinations = rows
      .map((r) => r.locationTag)
      .filter(Boolean)
      .map((s) => String(s).trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
    res.json({ success: true, destinations });
  } catch (err) {
    next(err);
  }
};

module.exports = { getFeed, getFollowingFeed, getDestinations };

