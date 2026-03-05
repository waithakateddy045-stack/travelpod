const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { authenticate } = require('../middleware/auth');
const {
    saveProfile,
    uploadAvatar,
    saveBusinessProfile,
    completeOnboarding,
} = require('../controllers/onboardingController');

// Multer config for avatar uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, '../../uploads/avatars')),
    filename: (req, file, cb) => cb(null, `${req.user.id}-${Date.now()}${path.extname(file.originalname)}`),
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|webp/;
        const ext = allowed.test(path.extname(file.originalname).toLowerCase());
        const mime = allowed.test(file.mimetype);
        cb(ext && mime ? null : new Error('Only JPEG, PNG, and WebP images are allowed'), ext && mime);
    },
});

// All onboarding routes require authentication
router.use(authenticate);

router.post('/profile', saveProfile);
router.post('/avatar', upload.single('avatar'), uploadAvatar);
router.post('/business', saveBusinessProfile);
router.post('/complete', completeOnboarding);

module.exports = router;
