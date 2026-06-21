import axios from "axios";

const AUTH_KEY = process.env.MSG91_AUTH_KEY!;
const TEMPLATE_ID = process.env.MSG91_TEMPLATE_ID!;

export async function sendSmsOtp(phone: string): Promise<{ success: boolean; error?: string }> {
  try {
    // MSG91 expects phone without + prefix
    const cleanPhone = phone.replace("+", "");

    const response = await axios.post(
      "https://control.msg91.com/api/v5/otp",
      {
        template_id: TEMPLATE_ID,
        mobile: cleanPhone,
        otp_length: 6,
        otp_expiry: 10,
      },
      {
        headers: {
          authkey: AUTH_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data.type === "success") {
      return { success: true };
    }

    return { success: false, error: response.data.message };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function verifySmsOtp(phone: string, otp: string): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanPhone = phone.replace("+", "");

    const response = await axios.get(
      "https://control.msg91.com/api/v5/otp/verify",
      {
        params: {
          mobile: cleanPhone,
          otp,
        },
        headers: {
          authkey: AUTH_KEY,
        },
      }
    );

    if (response.data.type === "success") {
      return { success: true };
    }

    return { success: false, error: response.data.message };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
