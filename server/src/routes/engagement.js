const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
    likePost, unlikePost,
    savePost, unsavePost,
    addComment, getComments, getReplies, deleteComment,
    toggleCommentLike,
    getSavedPosts
} = require('../controllers/engagementController');

// Likes
router.post('/like/:postId', authenticate, likePost);
router.delete('/like/:postId', authenticate, unlikePost);

// Saves
router.get('/saves', authenticate, getSavedPosts);
router.post('/save/:postId', authenticate, savePost);
router.delete('/save/:postId', authenticate, unsavePost);

// Comments
// PRD routes (singular) + backwards-compatible aliases (plural)
router.post('/comment/:postId', authenticate, addComment);
router.post('/comments/:postId', authenticate, addComment);

router.get('/comments/:postId', getComments);
router.get('/comment/:postId', getComments);

router.get('/comments/:commentId/replies', getReplies);

router.delete('/comment/:commentId', authenticate, deleteComment);
router.delete('/comments/:commentId', authenticate, deleteComment);

// Comment likes
router.post('/comment-like/:commentId', authenticate, toggleCommentLike);

module.exports = router;
