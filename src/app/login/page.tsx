import { db } from "@/lib/db";
import { LoginForm } from "@/components/login-form";
export const dynamic = "force-dynamic";
export default async function Login({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  return <LoginForm setupAvailable={await db.user.count() === 0} message={q.password === "changed" ? "Password saved. Sign in with your new password." : q.setup === "complete" ? "Workspace created. Sign in to connect your authenticator." : ""} />;
}
