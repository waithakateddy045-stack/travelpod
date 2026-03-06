const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getSettings, updateEmail, updatePassword, deleteAccount, updateSocialLinks } = require('../controllers/settingsController');

router.get('/', authenticate, getSettings);
router.put('/email', authenticate, updateEmail);
router.put('/password', authenticate, updatePassword);
router.put('/social', authenticate, updateSocialLinks);
router.delete('/account', authenticate, deleteAccount);

module.exports = router;
