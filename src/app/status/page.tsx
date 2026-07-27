import AppShell from "@/components/AppShell";
import StatusClient from "@/components/StatusClient";
import { getCurrentUser } from "@/lib/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function StatusPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/prijava");

  return (
    <AppShell>
      <StatusClient myId={user.id} />
    </AppShell>
  );
}