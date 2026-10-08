import { loadEnv } from "../../env.js";

export interface OtpSender {
  sendPhone(phone: string, code: string): Promise<void>;
  sendEmail(email: string, code: string): Promise<void>;
}

/** Development sender: logs the OTP, never used in production. */
export class ConsoleOtpSender implements OtpSender {
  async sendPhone(phone: string, code: string) {
    console.log(`[otp][dev] phone ${phone} -> ${code}`);
  }
  async sendEmail(email: string, code: string) {
    console.log(`[otp][dev] email ${email} -> ${code}`);
  }
}

/** MSG91 SMS OTP delivery (https://docs.msg91.com). */
export class Msg91OtpSender implements OtpSender {
  constructor(
    private readonly authKey: string,
    private readonly templateId: string,
  ) {}

  async sendPhone(phone: string, code: string) {
    const mobile = phone.replace("+", "");
    const response = await fetch("https://control.msg91.com/api/v5/flow/", {
      method: "POST",
      headers: { "Content-Type": "application/json", authkey: this.authKey },
      body: JSON.stringify({
        template_id: this.templateId,
        recipients: [{ mobiles: mobile, otp: code }],
      }),
    });
    if (!response.ok) {
      throw new Error(`MSG91 send failed: ${response.status} ${await response.text()}`);
    }
  }

  async sendEmail(_email: string, _code: string) {
    throw new Error("MSG91 email delivery is not configured; use the email provider instead");
  }
}

/** Resend email delivery (https://resend.com/docs). */
export class ResendOtpSender implements OtpSender {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async sendEmail(email: string, code: string) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: this.from,
        to: [email],
        subject: "Your FightFind verification code",
        text: `Your FightFind verification code is ${code}. It expires in a few minutes.`,
        html: `<p>Your FightFind verification code is <strong style="font-size:20px">${code}</strong>.</p><p>It expires in a few minutes. If you did not request this, ignore this email.</p>`,
      }),
    });
    if (!response.ok) {
      throw new Error(`Resend send failed: ${response.status} ${await response.text()}`);
    }
  }

  async sendPhone(_phone: string, _code: string) {
    throw new Error("Resend cannot deliver SMS; configure MSG91 for phone OTPs");
  }
}

/** Composition root for OTP delivery based on environment configuration. */
export function createOtpSender(): OtpSender {
  const env = loadEnv();
  if (env.NODE_ENV === "production") {
    const hasMsg91 = Boolean(env.MSG91_AUTH_KEY && env.MSG91_TEMPLATE_ID);
    const hasResend = Boolean(env.RESEND_API_KEY);
    if (!hasMsg91 && !hasResend) {
      throw new Error(
        "No OTP delivery provider configured. Set MSG91_AUTH_KEY+MSG91_TEMPLATE_ID and/or RESEND_API_KEY.",
      );
    }
    return new CompositeOtpSender({
      phone: hasMsg91 ? new Msg91OtpSender(env.MSG91_AUTH_KEY, env.MSG91_TEMPLATE_ID) : null,
      email: hasResend ? new ResendOtpSender(env.RESEND_API_KEY, env.EMAIL_FROM) : null,
    });
  }
  return new CompositeOtpSender({
    phone: env.MSG91_AUTH_KEY && env.MSG91_TEMPLATE_ID ? new Msg91OtpSender(env.MSG91_AUTH_KEY, env.MSG91_TEMPLATE_ID) : new ConsoleOtpSender(),
    email: env.RESEND_API_KEY ? new ResendOtpSender(env.RESEND_API_KEY, env.EMAIL_FROM) : new ConsoleOtpSender(),
  });
}

class CompositeOtpSender implements OtpSender {
  constructor(private readonly senders: { phone: OtpSender | null; email: OtpSender | null }) {}

  async sendPhone(phone: string, code: string) {
    const sender = this.senders.phone;
    if (!sender) throw new Error("Phone OTP delivery is not configured");
    await sender.sendPhone(phone, code);
  }

  async sendEmail(email: string, code: string) {
    const sender = this.senders.email;
    if (!sender) throw new Error("Email OTP delivery is not configured");
    await sender.sendEmail(email, code);
  }
}
