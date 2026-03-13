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
    getSessions,
    deleteSession,
    deleteAllSessions,
    resendOtp,
    verifyOtp,
    verifyAdminMfa,
    confirmAdminOtp,
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

// Email verification / OTP
router.get('/verify-email/:token', verifyEmail);
router.post('/verify-otp', verifyOtp);
router.post('/resend-otp', resendOtp);
router.post('/verify-admin-mfa', verifyAdminMfa);
router.post('/confirm-admin-otp', confirmAdminOtp);

// Authenticated user info
router.get('/me', authenticate, me);

// Session management
router.get('/sessions', authenticate, getSessions);
router.delete('/sessions/all', authenticate, deleteAllSessions);
router.delete('/sessions/:id', authenticate, deleteSession);

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
        const { accessToken, refreshToken, sessionToken, onboardingComplete } = req.user;
        const source = req.query.state;

        if (source === 'app') {
            res.redirect(`travelpod://callback?accessToken=${accessToken}&refreshToken=${refreshToken}&sessionToken=${sessionToken}&onboarding=${onboardingComplete}`);
        } else {
            // Set HttpOnly cookie for web
            res.cookie('travelpod_session', sessionToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
            });

            // Redirect to frontend with tokens in query (frontend stores them)
            res.redirect(
                `${process.env.CLIENT_URL}/auth/callback?accessToken=${accessToken}&refreshToken=${refreshToken}&sessionToken=${sessionToken}&onboarding=${onboardingComplete}`
            );
        }
    }
);

module.exports = router;
