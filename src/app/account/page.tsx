import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PasswordForm } from "@/components/password-form";
export default async function AccountPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const u = await db.user.findUniqueOrThrow({ where: { id: session.user.id } });
  return <PasswordForm required={u.mustChangePassword} />;
}
