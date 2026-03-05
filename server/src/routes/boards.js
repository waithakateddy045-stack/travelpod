const express = require('express');
const router = express.Router();
const { authenticate, optionalAuth } = require('../middleware/auth');
const {
    createBoard, getBoardsFeed, getBoard, updateBoard, deleteBoard,
    addVideoToBoard, removeVideoFromBoard, getUserBoards,
    toggleLike, toggleSave, toggleFollow,
    getComments, addComment, deleteComment,
} = require('../controllers/boardController');

// Public feed — optionalAuth for engagement status
router.get('/feed', optionalAuth, getBoardsFeed);

// User boards by handle
router.get('/user/:handle', getUserBoards);

// Board CRUD
router.post('/', authenticate, createBoard);
router.get('/:id', optionalAuth, getBoard);
router.put('/:id', authenticate, updateBoard);
router.delete('/:id', authenticate, deleteBoard);

// Videos on a board
router.post('/:id/videos', authenticate, addVideoToBoard);
router.delete('/:id/videos/:postId', authenticate, removeVideoFromBoard);

// Engagement
router.post('/:id/like', authenticate, toggleLike);
router.post('/:id/save', authenticate, toggleSave);
router.post('/:id/follow', authenticate, toggleFollow);

// Comments
router.get('/:id/comments', getComments);
router.post('/:id/comments', authenticate, addComment);
router.delete('/:id/comments/:commentId', authenticate, deleteComment);

module.exports = router;
