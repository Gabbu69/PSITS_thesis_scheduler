import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { Workspace } from "@/components/workspace";
export default async function Page() {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) redirect("/login");
  return <Workspace />;
}
