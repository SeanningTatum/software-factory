// software-factory-lint allow comments
import { emailOTPClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const codeClient = createAuthClient({ plugins: [emailOTPClient()] });

/** Better Auth answers `{ error }` instead of rejecting; the code machine wants a rejection. */
export const orReject = async (call: Promise<{ error: { message?: string } | null }>) => {
  const { error } = await call;
  if (error) return Promise.reject(new Error(error.message ?? "Something went wrong"));
};
