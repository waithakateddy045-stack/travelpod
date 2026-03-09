const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { optionalAuth, authenticate } = require('../middleware/auth');
const { createBroadcast, getBroadcasts, getBroadcastsForUser, getBroadcastsExplore, markBroadcastViewed } = require('../controllers/broadcastController');

// Multer config for broadcast media
const uploadDir = path.join(os.tmpdir(), 'travelpod-broadcasts');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, `bc-${req.user.id}-${Date.now()}${path.extname(file.originalname)}`),
});

const upload = multer({
    storage,
    limits: { fileSize: 200 * 1024 * 1024 }, // 200MB total limit
});

// Admin/Association: create broadcast with rich media
router.post('/', authenticate, upload.fields([
    { name: 'video', maxCount: 1 },
    { name: 'images', maxCount: 4 }
]), createBroadcast);

// Admin: list all broadcasts
router.get('/', authenticate, getBroadcasts);

// User: get broadcasts targeted at them
router.get('/inbox', authenticate, getBroadcastsForUser);

// User: mark broadcast as viewed
router.put('/:id/viewed', authenticate, markBroadcastViewed);

// Public/User: explore discovery broadcasts
router.get('/explore', optionalAuth, getBroadcastsExplore);

module.exports = router;
