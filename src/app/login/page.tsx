import { db } from "@/lib/db";
import { LoginForm } from "@/components/login-form";
import { turnstileConfigured } from "@/lib/turnstile";
export const dynamic = "force-dynamic";
export default async function Login({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  return <LoginForm setupAvailable={await db.user.count() === 0} siteKey={turnstileConfigured() ? process.env.TURNSTILE_SITE_KEY! : ""} message={q.password === "changed" ? "Password saved. Sign in with your new password." : q.setup === "complete" ? "Workspace created. Sign in to set up password recovery." : ""} />;
}
