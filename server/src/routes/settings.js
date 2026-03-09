const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getSettings, updateEmail, updatePassword, deleteAccount, updateSocialLinks, updateProfile, updateAvatar } = require('../controllers/settingsController');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

router.get('/', authenticate, getSettings);
router.put('/profile', authenticate, updateProfile);
router.post('/avatar', authenticate, upload.single('avatar'), updateAvatar);
router.put('/email', authenticate, updateEmail);
router.put('/password', authenticate, updatePassword);
router.put('/social', authenticate, updateSocialLinks);
router.delete('/account', authenticate, deleteAccount);

module.exports = router;
