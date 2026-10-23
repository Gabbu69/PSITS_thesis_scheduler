import { headers } from "next/headers";
import { auth } from "./auth";
export type Actor = { id: string; name: string; role: string };
export async function actor(): Promise<Actor> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("UNAUTHORIZED");
  return session.user;
}
export function coordinator(user: Actor) {
  if (user.role !== "COORDINATOR") throw new Error("FORBIDDEN");
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
