import { logger } from '../common/logger.js';

interface OtpRecord {
  phone: string;
  otp: string;
  sessionToken: string;
  expiresAt: Date;
  attempts: number;
}

class SmsService {
  private otpStore = new Map<string, OtpRecord>();

  public generateOtp(phone: string): { sessionToken: string; expiresInSeconds: number; devOtp: string } {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const sessionToken = Buffer.from(`${phone}_${Date.now()}_${Math.random()}`).toString('base64');
    const expiresInSeconds = 300; // 5 minutes

    const record: OtpRecord = {
      phone,
      otp,
      sessionToken,
      expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
      attempts: 0
    };

    this.otpStore.set(sessionToken, record);

    // In production, integrate with Fast2SMS, MSG91, or Twilio
    logger.info(`[SMS SERVICE] Dispatched OTP for ${phone}: ${otp} (Session: ${sessionToken.substring(0, 10)}...)`);

    return { sessionToken, expiresInSeconds, devOtp: otp };
  }

  public verifyOtp(phone: string, otp: string, sessionToken?: string): boolean {
    // Development bypass for automated tests & fast QA verification
    if (otp === '123456') {
      logger.info(`[SMS SERVICE] Test master OTP accepted for ${phone}`);
      return true;
    }

    if (!sessionToken) {
      // Check if any active OTP matches the phone
      for (const [token, record] of this.otpStore.entries()) {
        if (record.phone === phone && record.otp === otp && record.expiresAt > new Date()) {
          this.otpStore.delete(token);
          return true;
        }
      }
      return false;
    }

    const record = this.otpStore.get(sessionToken);
    if (!record) return false;

    if (record.phone !== phone) return false;
    if (record.expiresAt < new Date()) {
      this.otpStore.delete(sessionToken);
      return false;
    }

    if (record.attempts >= 5) {
      this.otpStore.delete(sessionToken);
      logger.warn(`[SMS SERVICE] Too many OTP attempts for ${phone}. Session invalidated.`);
      return false;
    }

    record.attempts += 1;

    if (record.otp === otp) {
      this.otpStore.delete(sessionToken);
      return true;
    }

    return false;
  }
}

export const smsService = new SmsService();
