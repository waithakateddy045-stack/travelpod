const twilio = require('twilio');
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

const sendOTP = async (phone, otpCode) => {
  try {
    await client.messages.create({
      body: `Your Travelpod verification code is: ${otpCode}. Expires in 10 minutes.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phone
    });
    return { sent: true };
  } catch (err) {
    console.warn('SMS FAILED:', err.message, '| OTP:', otpCode);
    return { sent: false, devModeOtp: otpCode };
  }
};

module.exports = { sendOTP };
