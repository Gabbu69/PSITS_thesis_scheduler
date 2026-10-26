import { RecoveryForm } from "@/components/recovery-form";
import { turnstileConfigured } from "@/lib/turnstile";
export const dynamic = "force-dynamic";
export default function ForgotPassword() {
  return <RecoveryForm siteKey={turnstileConfigured() ? process.env.TURNSTILE_SITE_KEY! : ""} />;
}
