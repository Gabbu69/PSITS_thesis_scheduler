import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { Workspace } from "@/components/workspace";
import { db } from "@/lib/db";
import { ClassScheduleBoard } from "@/components/class-schedule-board";
export default async function Page({ params }: { params: Promise<{ page?: string[] }> }) {
  const path = "/" + ((await params).page ?? []).join("/");
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) {
    if (path === "/" || path === "/class-schedules") {
      return <main className="login-layout public-schedules-layout"><ClassScheduleBoard /></main>;
    }
    redirect("/faculty/login");
  }
  const user = await db.user.findUniqueOrThrow({ where: { id: s.user.id } });
  if (user.mustChangePassword) redirect("/account");
  if (!user.twoFactorEnabled) redirect("/security");
  const pages = ["/", "/groups", "/faculty", "/availability", "/rooms", "/drafts", "/calendar", "/class-schedules", "/notifications", "/waiting", "/reports", "/settings", "/accounts"];
  if (!pages.includes(path)) notFound();
  if (user.role !== "COORDINATOR" && ["/rooms", "/drafts", "/waiting", "/settings", "/accounts", ...(user.role === "STUDENT" ? ["/faculty"] : [])].includes(path)) redirect("/");
  return <Workspace />;
}
