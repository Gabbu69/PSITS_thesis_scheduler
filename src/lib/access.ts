import { PublicError } from "./validation";
import { headers } from "next/headers";
import { auth } from "./auth";
import { db } from "./db";
export type Actor = { id: string; name: string; role: string };
export async function actor(): Promise<Actor> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new PublicError("UNAUTHORIZED");
  const user = await db.user.findUniqueOrThrow({ where: { id: session.user.id } });
  if (user.mustChangePassword) throw new PublicError("PASSWORD_CHANGE_REQUIRED");
  if (!user.twoFactorEnabled) throw new PublicError("MFA_SETUP_REQUIRED");
  return { id: user.id, name: user.name, role: user.role };
}
export function coordinator(user: Actor) {
  if (user.role !== "COORDINATOR") throw new PublicError("FORBIDDEN");
}
export function canSeeSession(
  user: Actor,
  session: { status: string; participants: { userId: string }[] },
) {
  return (
    user.role === "COORDINATOR" ||
    (session.status !== "DRAFT" &&
      session.participants.some((p) => p.userId === user.id))
  );
}
