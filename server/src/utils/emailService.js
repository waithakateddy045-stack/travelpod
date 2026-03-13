const nodemailer = require('nodemailer');
const { getOTPTemplate, getWelcomeTemplate, getResetPasswordTemplate } = require('./email/templates');

/**
 * Hardened Gmail SMTP Transporter
 * Uses connection pooling and rate limiting for better reliability
 */
const transporter = nodemailer.createTransport({
  service: 'gmail',
  pool: true,
  maxConnections: 3,
  maxMessages: 100,
  rateDelta: 1000,
  rateLimit: 1, // 1 email per second max to avoid Gmail spam blocks
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

/**
 * Unified Email Sender with Fail-safe Timeout
 */
const sendEmail = async (options) => {
  const { to, subject, html, fallbackCode } = options;
  
  try {
    const sendPromise = transporter.sendMail({
      from: `"Travelpod" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      html
    });

    // 5-second timeout to prevent server execution from hanging
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('SMTP_TIMEOUT')), 5000)
    );

    await Promise.race([sendPromise, timeoutPromise]);
    console.log(`[EMAIL_SUCCESS] Sent: "${subject}" to ${to}`);
    return { sent: true };
  } catch (err) {
    console.warn(`[EMAIL_FAILED] ${err.message} | To: ${to} | Fallback: ${fallbackCode}`);
    return { sent: false, devModeOtp: fallbackCode };
  }
};

const sendOTP = async (email, otpCode) => {
  return sendEmail({
    to: email,
    subject: 'Your Travelpod verification code',
    html: getOTPTemplate(otpCode),
    fallbackCode: otpCode
  });
};

const sendWelcome = async (email, displayName) => {
  return sendEmail({
    to: email,
    subject: 'Welcome to Travelpod!',
    html: getWelcomeTemplate(displayName)
  });
};

const sendPasswordReset = async (email, resetUrl) => {
  return sendEmail({
    to: email,
    subject: 'Reset your Travelpod password',
    html: getResetPasswordTemplate(resetUrl)
  });
};

module.exports = { 
  sendOTP, 
  sendWelcome,
  sendPasswordReset
};
