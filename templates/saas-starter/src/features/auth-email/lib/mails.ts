import { createElement } from "react";
import type { Mail } from "#/features/core/email/api/email.ts";
import { renderMail } from "#/features/core/email-templates/lib/render.ts";
import { CodeMail } from "../components/code-mail.tsx";

export type CodeKind = "sign-in" | "email-verification" | "forget-password" | "change-email";

const purpose: Record<CodeKind, { subject: string; lead: string }> = {
  "sign-in": { subject: "Your sign-in code", lead: "Use this code to sign in." },
  "email-verification": {
    subject: "Confirm your email address",
    lead: "Use this code to confirm your email address.",
  },
  "forget-password": {
    subject: "Reset your password",
    lead: "Use this code to set a new password.",
  },
  "change-email": {
    subject: "Confirm your new email address",
    lead: "Use this code to confirm your new email address.",
  },
};

export const codeMail = (kind: CodeKind, code: string): Omit<Mail, "to"> => {
  const { subject, lead } = purpose[kind];
  const parts = renderMail(createElement(CodeMail, { heading: subject, lead, code }));
  return { subject, ...parts };
};
