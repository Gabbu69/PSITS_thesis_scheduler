import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { passwordSchema } from "@/lib/accounts";
import { z } from "zod";
import { serialized } from "@/lib/scheduling";
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
    await db.$transaction(async (tx) => {
      await tx.account.update({ where: { id: account.id }, data: { password } });
      await tx.user.update({ where: { id: session.user.id }, data: { mustChangePassword: false } });
      await tx.authSession.deleteMany({ where: { userId: session.user.id } });
      await tx.verification.deleteMany({ where: { id: attemptId } });
    });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Choose a different password with at least 12 characters." }, { status: 400 }); }
}
