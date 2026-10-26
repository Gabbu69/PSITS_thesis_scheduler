import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { symmetricDecrypt, hashPassword } from "better-auth/crypto";
import { createOTP } from "@better-auth/utils/otp";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { passwordSchema } from "@/lib/accounts";
import { serialized } from "@/lib/scheduling";
import { freshPassword, savePassword } from "@/lib/passwords";
import { TurnstileError, verifyTurnstile } from "@/lib/turnstile";

const inputSchema = z.object({ email: z.string().trim().toLowerCase().max(254).pipe(z.email()), code: z.string().regex(/^\d{6}$/), password: passwordSchema });
const failure = { error: "Could not reset password. Check your email and current authenticator code, or contact your coordinator. After repeated attempts, wait 15 minutes." };
export async function POST(req: NextRequest) {
  if (req.headers.get("origin") !== req.nextUrl.origin) return NextResponse.json({ error: "Request not allowed." }, { status: 403 });
  try {
    await verifyTurnstile(req.headers.get("x-captcha-response"), "password_reset");
    const input = inputSchema.parse(await req.json());
    // Persistent per-email budget also covers nonexistent accounts, without exposing enrollment.
    const digest = createHash("sha256").update(input.email).digest("hex");
    const attemptId = `recovery-attempts-${digest}`;
    const allowed = await serialized(async (tx) => {
      const prior = await tx.verification.findUnique({ where: { id: attemptId } });
      const active = prior && prior.expiresAt > new Date();
      if (active && Number(prior.value) >= 5) return false;
      const expiresAt = active ? prior.expiresAt : new Date(Date.now() + 900000);
      const value = String(active ? Number(prior.value) + 1 : 1);
      await tx.verification.upsert({ where: { id: attemptId }, create: { id: attemptId, identifier: attemptId, value, expiresAt }, update: { value, expiresAt } });
      return true;
    });
    if (!allowed) return NextResponse.json(failure, { status: 429 });
    const password = await hashPassword(input.password);
    const secretConfig = (await auth.$context).secretConfig;
    const result = await serialized(async (tx) => {
      const user = await tx.user.findUnique({ where: { email: input.email }, include: { twoFactors: true, accounts: true } });
      const factor = user?.twoFactors.find((entry) => entry.verified);
      const account = user?.accounts.find((entry) => entry.providerId === "credential");
      if (!user?.twoFactorEnabled || !factor || !account?.password) return "invalid";
      if (factor.lockedUntil && factor.lockedUntil > new Date()) return "invalid";
      const secret = await symmetricDecrypt({ key: secretConfig, data: factor.secret });
      const consumedId = `recovery-used-${createHash("sha256").update(`${factor.id}:${input.code}`).digest("hex")}`;
      const consumed = await tx.verification.findUnique({ where: { id: consumedId } });
      if ((consumed && consumed.expiresAt > new Date()) || !await createOTP(secret).verify(input.code)) return "invalid";
      // A verified code is consumed even when the proposed password was used recently.
      const expiresAt = new Date(Date.now() + 120000);
      await tx.verification.upsert({ where: { id: consumedId }, create: { id: consumedId, identifier: consumedId, value: "used", expiresAt }, update: { expiresAt } });
      if (!await freshPassword(tx, user.id, account.password, input.password)) return "reused";
      await savePassword(tx, { ...account, password: account.password }, password);
      await tx.twoFactor.update({ where: { id: factor.id }, data: { failedVerificationCount: 0, lockedUntil: null } });
      await tx.verification.deleteMany({ where: { id: attemptId } });
      await tx.auditEvent.create({ data: { actorId: user.id, action: "PASSWORD_RECOVERED", details: "Password reset with authenticator; existing sessions revoked." } });
      return "saved";
    });
    if (result === "reused") return NextResponse.json({ error: "Choose a fresh password that differs from your current and last five passwords. Use a new authenticator code when you retry." }, { status: 400 });
    if (result !== "saved") return NextResponse.json(failure, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof TurnstileError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json(failure, { status: 400 });
  }
}
