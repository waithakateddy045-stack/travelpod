const express = require('express');
const router = express.Router();
const passport = require('passport');
const {
    register,
    login,
    logout,
    refresh,
    forgotPassword,
    resetPassword,
    verifyEmail,
    me,
} = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

// Email/password auth
router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);
router.post('/refresh', refresh);

// Password reset
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Email verification
router.get('/verify-email/:token', verifyEmail);

// Authenticated user info
router.get('/me', authenticate, me);

// Google OAuth
router.get('/google', (req, res, next) => {
    passport.authenticate('google', {
        scope: ['profile', 'email'],
        session: false,
        state: req.query.source === 'app' ? 'app' : 'web'
    })(req, res, next);
});

router.get('/google/callback',
    passport.authenticate('google', { session: false, failureRedirect: `${process.env.CLIENT_URL}/auth/login?error=oauth_failed` }),
    (req, res) => {
        const { accessToken, refreshToken } = req.user;
        const source = req.query.state;

        if (source === 'app') {
            res.redirect(`travelpod://callback?accessToken=${accessToken}&refreshToken=${refreshToken}&onboarding=${req.user.onboardingComplete}`);
        } else {
            // Redirect to frontend with tokens in query (frontend stores them)
            res.redirect(
                `${process.env.CLIENT_URL}/auth/callback?accessToken=${accessToken}&refreshToken=${refreshToken}&onboarding=${req.user.onboardingComplete}`
            );
        }
    }
);

module.exports = router;
