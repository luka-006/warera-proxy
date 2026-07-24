import AppShell from "@/components/AppShell";
import { getCurrentUser } from "@/lib/session";
import PlansClient from "@/components/PlansClient";

export const dynamic = "force-dynamic";

export default async function PlanPage() {
  const user = await getCurrentUser();
  const canWrite = user?.rank === "admin" || user?.rank === "zapovjednik";

  return (
    <AppShell>
      <PlansClient canWrite={Boolean(canWrite)} />
    </AppShell>
  );
}
