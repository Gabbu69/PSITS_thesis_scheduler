import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { twoFactor } from "better-auth/plugins";
import { db } from "./db";
export const auth = betterAuth({
  appName: "PSITS Thesis Scheduler",
  plugins: [twoFactor({ issuer: "PSITS Thesis Scheduler", accountLockout: { enabled: true, maxFailedAttempts: 5, durationSeconds: 900 } })],
  database: prismaAdapter(db, { provider: "postgresql" }),
  session: { modelName: "AuthSession" },
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 12,
  },
  user: {
    additionalFields: {
      role: { type: "string", defaultValue: "STUDENT", input: false },
    },
  },
  rateLimit: { enabled: true, window: 60, max: 50 },
});
