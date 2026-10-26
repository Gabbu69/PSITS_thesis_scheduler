import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { twoFactor } from "better-auth/plugins";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { db } from "./db";
import { TurnstileError, verifyTurnstile } from "./turnstile";
const recoveryAuthenticator = twoFactor({ issuer: "PSITS Thesis Scheduler" });
export const auth = betterAuth({
  appName: "PSITS Thesis Scheduler",
  // Keep Better Auth's encrypted enrollment and verification endpoints, but omit its
  // sign-in challenge hook. The authenticator is exclusively for password recovery.
  // Verified against the installed Better Auth 1.7.12 plugin implementation.
  plugins: [{ ...recoveryAuthenticator, hooks: undefined, endpoints: {
    enableTwoFactor: recoveryAuthenticator.endpoints.enableTwoFactor,
    verifyTOTP: recoveryAuthenticator.endpoints.verifyTOTP,
  } }],
  hooks: { before: createAuthMiddleware(async (ctx) => {
    if (["/change-password", "/set-password", "/reset-password", "/request-password-reset"].includes(ctx.path))
      throw new APIError("FORBIDDEN", { message: "Use the account password or forgot-password page." });
    // Old pending 2FA cookies must never become an alternative sign-in route.
    if (ctx.path.startsWith("/two-factor/") && !await auth.api.getSession({ headers: ctx.headers ?? new Headers() }))
      throw new APIError("UNAUTHORIZED", { message: "Sign in to configure password recovery." });
    if (ctx.path.startsWith("/sign-in/")) {
      try { await verifyTurnstile(ctx.headers?.get("x-captcha-response") ?? null, "login"); }
      catch (error) {
        const failure = error as TurnstileError;
        throw new APIError(failure.status === 503 ? "SERVICE_UNAVAILABLE" : "BAD_REQUEST", { message: failure.message, code: "TURNSTILE_FAILED" });
      }
    }
  }) },
  database: prismaAdapter(db, { provider: "postgresql" }),
  session: { modelName: "AuthSession" },
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
  },
  user: {
    additionalFields: {
      role: { type: "string", defaultValue: "STUDENT", input: false },
    },
  },
  rateLimit: { enabled: true, storage: "database", window: 60, max: 50 },
});
