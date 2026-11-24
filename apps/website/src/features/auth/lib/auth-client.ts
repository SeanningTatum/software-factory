import { createAuthClient } from "better-auth/react";

/** The browser side of Better Auth. Every call goes to /api/auth on this origin. */
export const authClient = createAuthClient();
