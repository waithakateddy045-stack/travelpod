const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getSettings, updateEmail, updatePassword, deleteAccount, updateSocialLinks, updateProfile, updateAvatar } = require('../controllers/settingsController');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const os = require('os');
const uploadDir = path.join(os.tmpdir(), 'travelpod-avatars');
if (!fs.existsSync(uploadDir)) { fs.mkdirSync(uploadDir, { recursive: true }); }

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, `${req.user.id}-settings-${Date.now()}${path.extname(file.originalname)}`),
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }
});

router.get('/', authenticate, getSettings);
router.put('/profile', authenticate, updateProfile);
router.post('/avatar', authenticate, upload.single('avatar'), updateAvatar);
router.put('/email', authenticate, updateEmail);
router.put('/password', authenticate, updatePassword);
router.put('/social', authenticate, updateSocialLinks);
router.delete('/account', authenticate, deleteAccount);

module.exports = router;
