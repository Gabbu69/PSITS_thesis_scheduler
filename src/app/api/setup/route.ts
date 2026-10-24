import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual, randomUUID, createHash } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { setupSchema } from "@/lib/accounts";
import { serialized } from "@/lib/scheduling";

export async function POST(req: NextRequest) {
  if (req.headers.get("origin") !== req.nextUrl.origin)
    return NextResponse.json({ error: "Request not allowed." }, { status: 403 });
  try {
    const input = setupSchema.parse(await req.json());
    const key = process.env.SETUP_KEY;
    const digest = (s: string) => createHash("sha256").update(s).digest();
    if (!key || key.length < 32 || !timingSafeEqual(digest(key), digest(input.key)))
      return NextResponse.json({ error: "The setup key is incorrect." }, { status: 403 });
    // Hash before taking the transaction lock. Only an empty database can be claimed.
    const password = await hashPassword(input.password);
    await serialized(async (tx) => {
      if (await tx.user.count()) throw new Error("Setup is already complete. Sign in instead.");
      const id = randomUUID();
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
      await tx.college.upsert({ where: { id: 1 }, update: { name: input.college }, create: { id: 1, name: input.college } });
      await tx.rules.upsert({ where: { id: 1 }, update: {}, create: { id: 1, startDate: today, endDate: today } });
      await tx.user.create({ data: {
        id, name: input.name, email: input.email, role: "COORDINATOR",
        accounts: { create: { id: randomUUID(), accountId: id, providerId: "credential", password } },
      } });
      await tx.auditEvent.create({ data: { actorId: id, action: "SETUP", details: "Coordinator created the college workspace." } });
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error && e.message.startsWith("Setup") ? e.message : "Check your details. Use a real email and a password of at least 12 characters." }, { status: 400 });
  }
}
