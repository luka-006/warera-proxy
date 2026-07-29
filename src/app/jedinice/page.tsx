import AppShell from "@/components/AppShell";
import { getCurrentUser } from "@/lib/session";
import { isCommandRank } from "@/lib/ranks";
import UnitsClient from "@/components/UnitsClient";

export const dynamic = "force-dynamic";

export default async function JedinicePage() {
  const user = await getCurrentUser();
  return (
    <AppShell>
      <UnitsClient
        isAdmin={user?.rank === "admin"}
        canCommand={isCommandRank(user?.rank)}
      />
    </AppShell>
  );
}