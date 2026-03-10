const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const jwt = require('jsonwebtoken');
const prisma = require('../utils/prisma');

const generateAccessToken = (user) =>
    jwt.sign(
        { id: user.id, email: user.email, accountType: user.accountType },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRY || '7d' }
    );

const storeSessionToken = async (userId, accessToken) => {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const session = await prisma.session.create({
        data: {
            userId,
            token: accessToken,
            deviceType: 'WEB',
            expiresAt,
            lastActiveAt: now,
        },
    });
    return session;
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
                    const baseHandle =
                        email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').slice(0, 16) || 'traveler';

                    let candidate = baseHandle.toLowerCase();
                    let counter = 1;
                    // Ensure unique username
                    // eslint-disable-next-line no-constant-condition
                    while (true) {
                        const existing = await prisma.user.findUnique({
                            where: { username: candidate },
                            select: { id: true },
                        });
                        if (!existing) break;
                        candidate = `${baseHandle.toLowerCase()}${counter}`;
                        counter += 1;
                    }

                    const displayName =
                        profile.displayName || profile.name?.givenName || baseHandle || 'Traveler';

                    user = await prisma.user.create({
                        data: {
                            email,
                            googleId: profile.id,
                            username: candidate,
                            displayName,
                            avatarUrl:
                                profile.photos?.[0]?.value ||
                                `https://api.dicebear.com/9.x/identicon/svg?seed=${encodeURIComponent(
                                    candidate
                                )}`,
                            accountType: 'TRAVELER',
                        },
                    });
                } else if (!user.googleId) {
                    // Existing email account — link Google OAuth
                    user = await prisma.user.update({
                        where: { id: user.id },
                        data: { googleId: profile.id },
                    });
                }

                if (user.isSuspended) {
                    return done(new Error('Account access denied'), null);
                }

                const jwtAccessToken = generateAccessToken(user);
                const session = await storeSessionToken(user.id, jwtAccessToken);
                const sessionToken = session.token;

                return done(null, {
                    accessToken: jwtAccessToken,
                    refreshToken: null,
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
