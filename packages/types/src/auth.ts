export interface OtpRequest {
  phone: string;
}

export interface OtpVerify {
  phone: string;
  otp: string;
}

export interface AuthSession {
  userId: string;
  phone: string;
  token: string;
  expiresAt: string;
}
