/**
 * Travelpod Email Templates
 * Premium, responsive HTML designs
 */

const BASE_STYLE = `
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #000; color: #fff; margin: 0; padding: 0; }
  .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
  .card { background: #111; border: 1px solid #222; border-radius: 16px; padding: 40px; text-align: center; }
  .logo { font-size: 24px; font-weight: bold; color: #e94560; margin-bottom: 24px; }
  .title { font-size: 20px; margin-bottom: 16px; color: #fff; }
  .text { color: #aaa; line-height: 1.6; margin-bottom: 32px; }
  .code-container { background: #1a1a1a; border: 1px dashed #444; border-radius: 12px; padding: 24px; margin: 24px 0; }
  .code { font-size: 48px; letter-spacing: 12px; font-weight: bold; color: #fff; margin: 0; }
  .footer { margin-top: 40px; font-size: 12px; color: #555; text-align: center; }
  .btn { display: inline-block; background: #e94560; color: #fff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 16px; }
`;

const getOTPTemplate = (otpCode) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>${BASE_STYLE}</style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo">travelpod</div>
      <h1 class="title">Verify your email</h1>
      <p class="text">Use the code below to complete your verification. It will expire in 10 minutes.</p>
      <div class="code-container">
        <h2 class="code">${otpCode}</h2>
      </div>
      <p class="footer">If you didn't request this code, you can safely ignore this email.</p>
    </div>
  </div>
</body>
</html>
`;

const getWelcomeTemplate = (displayName) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>${BASE_STYLE}</style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo">travelpod</div>
      <h1 class="title">Welcome, ${displayName}!</h1>
      <p class="text">Your account is now verified. You're ready to start exploring and sharing your travel journeys.</p>
      <a href="https://travelpod-production.up.railway.app" class="btn">Launch Travelpod</a>
      <p class="footer">&copy; ${new Date().getFullYear()} Travelpod. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;

const getResetPasswordTemplate = (resetUrl) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>${BASE_STYLE}</style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo">travelpod</div>
      <h1 class="title">Reset your password</h1>
      <p class="text">We received a request to reset your password. Click the button below to choose a new one. This link expires in 1 hour.</p>
      <a href="${resetUrl}" class="btn">Reset Password</a>
      <p class="text" style="margin-top: 24px; font-size: 13px;">Or copy and paste this link: <br/> ${resetUrl}</p>
      <p class="footer">If you didn't request a password reset, please ignore this email.</p>
    </div>
  </div>
</body>
</html>
`;

module.exports = {
  getOTPTemplate,
  getWelcomeTemplate,
  getResetPasswordTemplate
};
