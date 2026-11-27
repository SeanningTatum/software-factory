import type { Mail } from "#/features/core/email/api/email.ts";

export type CodeKind = "sign-in" | "email-verification" | "forget-password" | "change-email";

const purpose: Record<CodeKind, { subject: string; lead: string }> = {
  "sign-in": { subject: "Your sign-in code", lead: "Use this code to sign in:" },
  "email-verification": {
    subject: "Confirm your email address",
    lead: "Use this code to confirm your email address:",
  },
  "forget-password": {
    subject: "Reset your password",
    lead: "Use this code to set a new password:",
  },
  "change-email": {
    subject: "Confirm your new email address",
    lead: "Use this code to confirm your new email address:",
  },
};

const FOOTER = "It expires in 5 minutes. If you didn't ask for it, you can ignore this email.";

/** The code is digits from our own generator, so it goes into the HTML as it is. */
export const codeMail = (kind: CodeKind, code: string): Omit<Mail, "to"> => {
  const { subject, lead } = purpose[kind];
  return {
    subject,
    text: `${lead}\n\n${code}\n\n${FOOTER}`,
    html: `<p>${lead}</p><p style="font-size:24px;letter-spacing:4px"><strong>${code}</strong></p><p>${FOOTER}</p>`,
  };
};
