import { stripeClient } from "@better-auth/stripe/client";
import { createAuthClient } from "better-auth/react";

export const billingClient = createAuthClient({ plugins: [stripeClient({ subscription: true })] });
