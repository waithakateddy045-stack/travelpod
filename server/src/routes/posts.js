const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { authenticate, optionalAuth, adminOnly } = require('../middleware/auth');
const {
    createPost, getPost, deletePost,
    getModerationQueue, moderatePost,
    repostPost, recommendPost, checkDuplicate,
    updatePost
} = require('../controllers/postController');
const { reportEntity } = require('../controllers/moderationController');

// Multer config for video uploads — use OS temp directory for serverless compatibility
const uploadDir = path.join(os.tmpdir(), 'travelpod-uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
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

// Public routes
router.get('/check-duplicate', checkDuplicate);
router.get('/:id', getPost);

// Post CRUD (Protected routes)
router.post('/', authenticate, upload.single('video'), createPost);
router.patch('/:id', authenticate, updatePost);
router.delete('/:id', authenticate, deletePost);

// Admin moderation
router.get('/moderation/queue', authenticate, adminOnly, getModerationQueue);
router.put('/moderation/:id', authenticate, adminOnly, moderatePost);

// Engagement & Hub
router.post('/:id/repost', authenticate, repostPost);
router.post('/:id/recommend', authenticate, recommendPost);

// Reporting — generic endpoint
router.post('/reports', optionalAuth, reportEntity);

module.exports = router;
