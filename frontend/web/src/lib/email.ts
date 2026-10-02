import nodemailer from 'nodemailer';

export const sendOtpEmail = async (to: string, otpCode: string, purpose: string = 'REGISTRATION_VERIFY') => {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
      },
    });

    const subject =
      purpose === 'FORGOT_PASSWORD'
        ? 'TalentPulse AI — Password Reset Verification Code'
        : 'TalentPulse AI — Verify Your Email Address';

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; background-color: #020617; color: #f8fafc; padding: 32px; border-radius: 12px; max-width: 500px; margin: 0 auto; border: 1px solid #1e293b;">
        <h2 style="color: #06b6d4; margin-bottom: 8px;">TalentPulse.AI</h2>
        <p style="color: #94a3b8; font-size: 14px;">Verification Security Code</p>
        <div style="background-color: #0f172a; border: 1px solid #334155; padding: 20px; border-radius: 8px; text-align: center; margin: 24px 0;">
          <span style="font-family: monospace; font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #38bdf8;">${otpCode}</span>
        </div>
        <p style="color: #94a3b8; font-size: 12px; margin-bottom: 4px;">This single-use code is valid for <strong>2 minutes (120 seconds)</strong>.</p>
        <p style="color: #64748b; font-size: 11px;">If you did not request this verification code, please ignore this message.</p>
      </div>
    `;

    // SECURITY: never log the OTP value. Never report success unless the
    // provider accepted the message. Missing credentials must fail closed
    // so the UI does not claim "code sent" when nothing was delivered.
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.error(`[OTP] Email delivery failed: SMTP credentials not configured (recipient=${to}, purpose=${purpose})`);
      return { success: false, error: 'Email service is not configured. Set SMTP_USER/SMTP_PASS.' };
    }

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || '"TalentPulse AI" <no-reply@talentpulse.ai>',
      to,
      subject,
      html: htmlContent,
    });

    console.log(`[OTP] Email provider accepted message (recipient=${to}, purpose=${purpose}, messageId=${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[OTP] Email delivery failed:', error);
    return { success: false, error: String(error) };
  }
};
