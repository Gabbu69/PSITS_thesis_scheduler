import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { SetupForm } from "@/components/setup-form";
export const dynamic = "force-dynamic";
export default async function SetupPage() {
  if (await db.user.count()) redirect("/login");
  return <SetupForm />;
}
