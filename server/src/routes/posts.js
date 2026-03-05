const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { authenticate, optionalAuth, adminOnly } = require('../middleware/auth');
const {
    createPost, getPost, deletePost,
    getModerationQueue, moderatePost, reportPost,
} = require('../controllers/postController');

// Multer config for video uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, '../../uploads/videos')),
    filename: (req, file, cb) => cb(null, `${req.user.id}-${Date.now()}${path.extname(file.originalname)}`),
});

const upload = multer({
    storage,
    limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
    fileFilter: (req, file, cb) => {
        const allowed = /mp4|mov|avi|webm|mkv/;
        const ext = allowed.test(path.extname(file.originalname).toLowerCase());
        cb(ext ? null : new Error('Only video files (MP4, MOV, AVI, WebM, MKV) are allowed'), ext);
    },
});

// Post CRUD
router.post('/', authenticate, upload.single('video'), createPost);
router.get('/:id', optionalAuth, getPost);
router.delete('/:id', authenticate, deletePost);

// Admin moderation
router.get('/moderation/queue', authenticate, adminOnly, getModerationQueue);
router.put('/moderation/:id', authenticate, adminOnly, moderatePost);

// Reporting
router.post('/:id/report', optionalAuth, reportPost);

module.exports = router;
