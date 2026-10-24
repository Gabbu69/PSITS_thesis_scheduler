import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { Workspace } from "@/components/workspace";
import { db } from "@/lib/db";
export default async function Page({ params }: { params: Promise<{ page?: string[] }> }) {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) redirect("/login");
  const user = await db.user.findUniqueOrThrow({ where: { id: s.user.id } });
  if (user.mustChangePassword) redirect("/account");
  if (!user.twoFactorEnabled) redirect("/security");
  const path = "/" + ((await params).page ?? []).join("/");
  const pages = ["/", "/groups", "/faculty", "/availability", "/rooms", "/drafts", "/calendar", "/notifications", "/waiting", "/reports", "/settings", "/accounts"];
  if (!pages.includes(path)) notFound();
  if (user.role !== "COORDINATOR" && ["/rooms", "/drafts", "/waiting", "/settings", "/accounts", ...(user.role === "STUDENT" ? ["/faculty"] : [])].includes(path)) redirect("/");
  return <Workspace />;
}
