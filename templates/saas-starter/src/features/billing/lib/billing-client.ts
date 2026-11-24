import { stripeClient } from "@better-auth/stripe/client";
import { createAuthClient } from "better-auth/react";

/** Better Auth's browser client with the Stripe plugin's subscription calls. */
export const billingClient = createAuthClient({ plugins: [stripeClient({ subscription: true })] });
