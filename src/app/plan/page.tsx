import AppShell from "@/components/AppShell";
import { getCurrentUser } from "@/lib/session";
import { isCommandRank } from "@/lib/ranks";
import PlansClient from "@/components/PlansClient";

export const dynamic = "force-dynamic";

export default async function PlanPage() {
  const user = await getCurrentUser();
  const canWrite = isCommandRank(user?.rank);

  return (
    <AppShell>
      <PlansClient canWrite={Boolean(canWrite)} />
    </AppShell>
  );
}
