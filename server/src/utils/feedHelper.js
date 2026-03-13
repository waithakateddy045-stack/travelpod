const prisma = require('./prisma');

/**
 * Fetches IDs of posts and boards that the user has already seen.
 * @param {string} userId - The ID of the authenticated user.
 * @returns {Promise<{ seenPostIds: string[], seenBoardIds: string[] }>}
 */
async function getSeenContentIds(userId) {
    if (!userId) return { seenPostIds: [], seenBoardIds: [] };

    const [postViews, boardViews] = await Promise.all([
        prisma.postView.findMany({
            where: { userId },
            select: { postId: true },
            take: 5000, // Limit to recent 5k to keep queries fast
            orderBy: { createdAt: 'desc' }
        }),
        prisma.boardView.findMany({
            where: { userId },
            select: { boardId: true },
            take: 1000,
            orderBy: { createdAt: 'desc' }
        })
    ]);

    return {
        seenPostIds: postViews.map(v => v.postId),
        seenBoardIds: boardViews.map(v => v.boardId)
    };
}

/**
 * Marks content as seen by the user in bulk.
 * @param {string} userId - The ID of the authenticated user.
 * @param {string[]} postIds - Array of post IDs to mark as seen.
 * @param {string[]} boardIds - Array of board IDs to mark as seen.
 */
async function markContentSeen(userId, postIds = [], boardIds = []) {
    if (!userId) return;

    try {
        const postOps = postIds.map(id => 
            prisma.postView.upsert({
                where: { userId_postId: { userId, postId: id } },
                update: {}, // No-op if exists
                create: { userId, postId: id }
            })
        );

        const boardOps = boardIds.map(id => 
            prisma.boardView.upsert({
                where: { userId_boardId: { userId, boardId: id } },
                update: {},
                create: { userId, boardId: id }
            })
        );

        // We use $transaction but allow failures for individual ops if they occur (though upsert handles most)
        if (postOps.length > 0 || boardOps.length > 0) {
            await prisma.$transaction([...postOps, ...boardOps]);
        }
    } catch (err) {
        console.error('Error marking content as seen:', err);
        // We don't throw here to avoid failing the main feed request
    }
}

module.exports = {
    getSeenContentIds,
    markContentSeen
};
