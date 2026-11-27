// software-factory-lint allow comments
export const SIGN_IN = "/api/auth/sign-in/email";
export const SIGN_UP = "/api/auth/sign-up/email";
export const SIGN_OUT = "/api/auth/sign-out";

/** Served only with the auth-email feature; each sends a mail or tries a code. */
export const CODE_SIGN_IN = "/api/auth/sign-in/email-otp";
export const VERIFY_EMAIL = "/api/auth/email-otp/verify-email";
export const RESET_PASSWORD = "/api/auth/email-otp/reset-password";
export const CODE_PATHS = [
  CODE_SIGN_IN,
  VERIFY_EMAIL,
  RESET_PASSWORD,
  "/api/auth/email-otp/send-verification-otp",
  "/api/auth/email-otp/request-password-reset",
];
