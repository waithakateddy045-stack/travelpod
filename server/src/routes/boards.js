const express = require('express');
const router = express.Router();
const boardController = require('../controllers/boardController');
const { authenticate, optionalAuth } = require('../middleware/auth');

// Public Routes — optionalAuth so logged-in users get engagement status
router.get('/feed', optionalAuth, boardController.getBoardsFeed);
router.get('/user/:handle', boardController.getUserBoards);
router.get('/:id', optionalAuth, boardController.getBoard);
router.get('/:id/comments', boardController.getComments);

// Protected Routes
router.use(authenticate);
router.get('/user/me', boardController.getMyBoards);
router.post('/', boardController.createBoard);
router.put('/:id', boardController.updateBoard);
router.delete('/:id', boardController.deleteBoard);

// Videos on a board
router.post('/:id/videos', boardController.addVideoToBoard);
router.delete('/:id/videos/:postId', boardController.removeVideoFromBoard);

// Engagement
router.post('/:id/like', boardController.toggleLike);
router.post('/:id/save', boardController.toggleSave);
router.post('/:id/follow', boardController.toggleFollow);

// Comments
router.post('/:id/comments', boardController.addComment);
router.delete('/:id/comments/:commentId', boardController.deleteComment);

module.exports = router;
