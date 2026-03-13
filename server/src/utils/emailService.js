const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const EMAIL_FROM = process.env.EMAIL_FROM || 'onboarding@resend.dev';

if (!process.env.RESEND_API_KEY) {
    console.error('❌ RESEND_API_KEY is missing from environment variables!');
} else {
    console.log('✅ RESEND_API_KEY is present (length: ' + process.env.RESEND_API_KEY.length + ')');
}

/**
 * Send OTP Verification Email
 */
const sendOTP = async (email, otpCode) => {
    try {
        const data = await resend.emails.send({
            from: `Travelpod <${EMAIL_FROM}>`,
            to: email,
            subject: 'Your Travelpod verification code',
            html: `
                <div style="font-family: Arial, sans-serif; background-color: #121212; color: #ffffff; padding: 40px 20px; text-align: center;">
                    <div style="max-width: 500px; margin: 0 auto; background-color: #1e1e1e; padding: 40px; border-radius: 12px; border: 1px solid #333;">
                        <h1 style="color: #ffffff; margin-bottom: 20px; font-size: 24px;">Welcome to Travelpod!</h1>
                        <p style="color: #bbbbbb; margin-bottom: 30px; font-size: 16px; line-height: 1.5;">
                            Please use the verification code below to complete your registration. This code will expire in 10 minutes.
                        </p>
                        <div style="background-color: #2d2d2d; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
                            <span style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #3b82f6;">${otpCode}</span>
                        </div>
                        <p style="color: #888888; font-size: 14px; margin-top: 30px;">
                            If you didn't request this code, you can safely ignore this email.
                        </p>
                    </div>
                </div>
            `
        });
        return { success: true, data };
    } catch (error) {
        console.error('Failed to send OTP email:', error);
        return { success: false, error };
    }
};

/**
 * Send Welcome Email
 */
const sendWelcome = async (email, displayName) => {
    try {
        const data = await resend.emails.send({
            from: `Travelpod <${EMAIL_FROM}>`,
            to: email,
            subject: 'Welcome to Travelpod! Your journey begins',
            html: `
                <div style="font-family: Arial, sans-serif; background-color: #121212; color: #ffffff; padding: 40px 20px; text-align: center;">
                    <div style="max-width: 500px; margin: 0 auto; background-color: #1e1e1e; padding: 40px; border-radius: 12px; border: 1px solid #333;">
                        <h1 style="color: #ffffff; margin-bottom: 20px; font-size: 24px;">Hello ${displayName || 'Explorer'},</h1>
                        <p style="color: #bbbbbb; margin-bottom: 30px; font-size: 16px; line-height: 1.5;">
                            Your profile is all set up. We're thrilled to have you join our community of travelers.
                        </p>
                        <a href="https://travelpod-liard.vercel.app/" style="display: inline-block; background-color: #3b82f6; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
                            Start Exploring
                        </a>
                    </div>
                </div>
            `
        });
        return { success: true, data };
    } catch (error) {
        console.error('Failed to send welcome email:', error);
        return { success: false, error };
    }
};

module.exports = {
    sendOTP,
    sendWelcome
};
