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
const sendOTP = async (email, otp) => {
    try {
        const data = await resend.emails.send({
            from: `Travelpod <${EMAIL_FROM}>`,
            to: email,
            subject: 'Verify your Travelpod account',
            html: `
                <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                    <h2 style="color: #6366f1;">Welcome to Travelpod!</h2>
                    <p>Your verification code is:</p>
                    <div style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #1e1e1e; background: #f4f4f5; padding: 15px; text-align: center; border-radius: 8px; margin: 20px 0;">
                        ${otp}
                    </div>
                    <p style="color: #666; font-size: 14px;">This code expires in 10 minutes. If you didn't request this, please ignore this email.</p>
                </div>
            `,
        });

        if (data.error) {
            // Handle Resend trial mode restriction (403 Forbidden - Restricted Recipient)
            if (data.error.statusCode === 403 || data.error.name === 'validation_error') {
                console.warn('⚠️ [TRIAL MODE] Resend restricted recipient. OTP for ' + email + ' is: ' + otp);
                console.warn('   To fix this permanently, verify your domain at https://resend.com/domains');
                return { success: true, simulated: true, otp };
            }
            
            console.error('❌ Resend Error (sendOTP):', JSON.stringify(data.error, null, 2));
            throw new Error(`Email failed: ${data.error.message}`);
        }

        console.log('✅ OTP sent successfully to ' + email + (data.data ? ' (ID: ' + data.data.id + ')' : ''));
        return { success: true, data: data.data };
    } catch (error) {
        console.error('💥 Critical Failure in sendOTP:', error);
        throw error;
    }
};

const sendMFAEmail = async (email, otp) => {
    try {
        const data = await resend.emails.send({
            from: `Travelpod <${EMAIL_FROM}>`,
            to: email,
            subject: 'Your Login Verification Code',
            html: `
                <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                    <h2 style="color: #6366f1;">Security Verification</h2>
                    <p>Use the code below to complete your sign-in:</p>
                    <div style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #1e1e1e; background: #f4f4f5; padding: 15px; text-align: center; border-radius: 8px; margin: 20px 0;">
                        ${otp}
                    </div>
                    <p style="color: #666; font-size: 14px;">This code is for your security. Do not share it with anyone.</p>
                </div>
            `,
        });

        if (data.error) {
            if (data.error.statusCode === 403 || data.error.name === 'validation_error') {
                console.warn('⚠️ [TRIAL MODE] Resend restricted recipient. MFA Code for ' + email + ' is: ' + otp);
                return { success: true, simulated: true, otp };
            }
            console.error('❌ Resend Error (sendMFAEmail):', JSON.stringify(data.error, null, 2));
            throw new Error(`MFA Email failed: ${data.error.message}`);
        }

        console.log('✅ MFA Email sent successfully to ' + email + (data.data ? ' (ID: ' + data.data.id + ')' : ''));
        return { success: true, data: data.data };
    } catch (error) {
        console.error('💥 Critical Failure in sendMFAEmail:', error);
        throw error;
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
    sendMFAEmail,
    sendWelcome
};
