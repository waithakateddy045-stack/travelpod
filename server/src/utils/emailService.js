const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

const sendOTP = async (email, otpCode) => {
  try {
    const sendPromise = transporter.sendMail({
      from: `Travelpod <${process.env.GMAIL_USER}>`,
      to: email,
      subject: 'Your Travelpod verification code',
      html: `<div style="font-family:sans-serif;background:#111;color:#fff;padding:40px;border-radius:12px;text-align:center"><h2 style="color:#e94560">Travelpod</h2><p>Your verification code is:</p><h1 style="font-size:56px;letter-spacing:16px;color:#ffffff;margin:24px 0">${otpCode}</h1><p style="color:#aaa">Expires in 10 minutes</p></div>`
    });
    
    // 4-second timeout to prevent hanging when SMTP is slow/blocked
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('SMTP Timeout')), 4000));
    
    await Promise.race([sendPromise, timeoutPromise]);
    return { sent: true };
  } catch (err) {
    console.warn('OTP FAILED (or timed out):', err.message, '| OTP:', otpCode);
    return { sent: false, devModeOtp: otpCode };
  }
};

const sendWelcome = async (email, displayName) => {
  try {
    const sendPromise = transporter.sendMail({
      from: `Travelpod <${process.env.GMAIL_USER}>`,
      to: email,
      subject: 'Welcome to Travelpod!',
      html: `<div style="font-family:sans-serif;background:#111;color:#fff;padding:40px;border-radius:12px;text-align:center"><h2 style="color:#e94560">Welcome to Travelpod, ${displayName}!</h2><p>Your account is verified. Start exploring.</p></div>`
    });
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('SMTP Timeout')), 4000));
    await Promise.race([sendPromise, timeoutPromise]);
    return { sent: true };
  } catch (err) {
    return { sent: false };
  }
};

module.exports = { sendOTP, sendWelcome };
