import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { passwordSchema } from "@/lib/accounts";
import { z } from "zod";
import { serialized } from "@/lib/scheduling";
import { freshPassword, savePassword } from "@/lib/passwords";
export async function POST(req: NextRequest) {
  if (req.headers.get("origin") !== req.nextUrl.origin) return NextResponse.json({ error: "Request not allowed." }, { status: 403 });
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return NextResponse.json({ error: "Sign in again." }, { status: 401 });
  try {
    const attemptId = `password-attempts-${session.user.id}`;
    const allowed = await serialized(async (tx) => {
      const prior = await tx.verification.findUnique({ where: { id: attemptId } });
      const active = prior && prior.expiresAt > new Date();
      if (active && Number(prior.value) >= 5) return false;
      const expiresAt = active ? prior.expiresAt : new Date(Date.now() + 15 * 60 * 1000);
      const value = String(active ? Number(prior.value) + 1 : 1);
      await tx.verification.upsert({ where: { id: attemptId }, update: { value, expiresAt }, create: { id: attemptId, identifier: attemptId, value, expiresAt } });
      return true;
    });
    if (!allowed) return NextResponse.json({ error: "Too many attempts. Wait 15 minutes and try again." }, { status: 429 });
    const input = z.object({ current: z.string().max(128), password: passwordSchema }).parse(await req.json());
    if (input.current === input.password) throw new Error("Choose a different password.");
    const account = await db.account.findFirst({ where: { userId: session.user.id, providerId: "credential" } });
    if (!account?.password || !await verifyPassword({ hash: account.password, password: input.current }))
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
    const password = await hashPassword(input.password);
    const saved = await serialized(async (tx) => {
      // Recheck under the lock: a concurrent recovery must invalidate this request.
      const active = await tx.authSession.findUnique({ where: { token: session.session.token } });
      const current = await tx.account.findUnique({ where: { id: account.id } });
      if (!active || !current?.password || current.password !== account.password) return false;
      if (!await freshPassword(tx, session.user.id, current.password, input.password)) return false;
      await savePassword(tx, { ...current, password: current.password }, password);
      await tx.verification.deleteMany({ where: { id: attemptId } });
      return true;
    });
    if (!saved) return NextResponse.json({ error: "Use a fresh password different from your current and last five passwords, or sign in again." }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Choose a fresh password with at least 12 characters." }, { status: 400 }); }
}
