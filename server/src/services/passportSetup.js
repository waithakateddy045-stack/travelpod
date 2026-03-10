const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const prisma = require('../utils/prisma');

const generateAccessToken = (user) =>
    jwt.sign(
        { id: user.id, email: user.email, accountType: user.accountType },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRY || '7d' }
    );

const storeRefreshToken = async (userId, refreshToken) => {
    const token = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    return await prisma.session.create({
        data: {
            userId,
            refreshToken,
            token,
            expiresAt
        }
    });
};

passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: process.env.GOOGLE_CALLBACK_URL,
        },
        async (accessToken, refreshTokenOAuth, profile, done) => {
            try {
                const email = profile.emails?.[0]?.value?.toLowerCase();
                if (!email) return done(new Error('No email from Google'), null);

                // Find existing user by googleId or email
                let user = await prisma.user.findFirst({
                    where: { OR: [{ googleId: profile.id }, { email }] },
                });

                if (!user) {
                    // New user — create account (default to TRAVELER until onboarding)
                    user = await prisma.user.create({
                        data: {
                            email,
                            googleId: profile.id,
                            emailVerified: true,
                            accountType: 'TRAVELER',
                        },
                    });
                } else if (!user.googleId) {
                    // Existing email account — link Google OAuth
                    user = await prisma.user.update({
                        where: { id: user.id },
                        data: { googleId: profile.id, emailVerified: true },
                    });
                }

                if (user.isSuspended || user.isDeleted) {
                    return done(new Error('Account access denied'), null);
                }

                const jwtAccessToken = generateAccessToken(user);
                const refreshToken = uuidv4();
                const session = await storeRefreshToken(user.id, refreshToken);
                const sessionToken = session.token;

                return done(null, {
                    accessToken: jwtAccessToken,
                    refreshToken,
                    sessionToken,
                    onboardingComplete: user.onboardingComplete,
                });
            } catch (err) {
                return done(err, null);
            }
        }
    )
);

module.exports = passport;
