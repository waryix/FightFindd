import dotenv from "dotenv";

dotenv.config();

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL;
const SENDER_NAME = process.env.BREVO_SENDER_NAME ?? "FightFind";
const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

export interface SendResult {
  sent: boolean;
  dev: boolean;
  error?: string;
}

function htmlTemplate(code: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#0a0a0a;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="420" cellpadding="0" cellspacing="0" style="background:#141414;border:1px solid #2a2a2a;border-radius:16px;overflow:hidden;">
            <tr>
              <td align="center" style="padding:32px 24px 8px;">
                <div style="width:64px;height:64px;border-radius:18px;background:#e63946;color:#fff;font-size:26px;font-weight:800;line-height:64px;text-align:center;">FF</div>
                <h1 style="color:#fff;font-size:22px;margin:16px 0 4px;">FightFind</h1>
                <p style="color:#888;font-size:13px;margin:0;">Find sparring partners. Train harder.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px;">
                <p style="color:#ccc;font-size:15px;margin:0 0 16px;">Use this code to verify your email address:</p>
                <div style="background:#0a0a0a;border:1px solid #2a2a2a;border-radius:12px;padding:18px;text-align:center;">
                  <span style="color:#e63946;font-size:34px;font-weight:800;letter-spacing:10px;">${code}</span>
                </div>
                <p style="color:#666;font-size:13px;margin:16px 0 0;">This code expires in 10 minutes. If you didn't request it, you can safely ignore this email.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px 28px;border-top:1px solid #2a2a2a;">
                <p style="color:#555;font-size:12px;margin:0;text-align:center;">FightFind &middot; For boxers, MMA fighters and kickboxers across India</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function textTemplate(code: string): string {
  return `Your FightFind verification code is ${code}.\n\nIt expires in 10 minutes. If you didn't request it, ignore this email.`;
}

export function isEmailConfigured(): boolean {
  return Boolean(BREVO_API_KEY && SENDER_EMAIL);
}

export async function sendOtpEmail(email: string, code: string): Promise<SendResult> {
  if (!isEmailConfigured()) {
    console.log(`[dev otp] email ${email} -> ${code} (Brevo not configured)`);
    return { sent: false, dev: true };
  }

  try {
    const response = await fetch(BREVO_ENDPOINT, {
      method: "POST",
      headers: {
        "api-key": BREVO_API_KEY as string,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: { email: SENDER_EMAIL, name: SENDER_NAME },
        to: [{ email }],
        subject: `${code} is your FightFind verification code`,
        htmlContent: htmlTemplate(code),
        textContent: textTemplate(code),
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error(`Brevo send failed (${response.status}): ${detail}`);
      return { sent: false, dev: false, error: `Brevo error ${response.status}` };
    }

    return { sent: true, dev: false };
  } catch (err: any) {
    console.error("Brevo send error:", err.message);
    return { sent: false, dev: false, error: err.message };
  }
}
