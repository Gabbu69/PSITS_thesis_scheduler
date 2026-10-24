import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { SecurityForm } from "@/components/security-form";
export default async function SecurityPage() {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) redirect("/login");
  const user = await db.user.findUniqueOrThrow({ where: { id: s.user.id } });
  if (user.mustChangePassword) redirect("/account");
  return <SecurityForm enabled={user.twoFactorEnabled} email={user.email} />;
}
