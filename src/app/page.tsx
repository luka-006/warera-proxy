import AppShell from "@/components/AppShell";
import { getCurrentUser } from "@/lib/session";
import { isCommandRank } from "@/lib/ranks";
import Watchtower from "@/components/Watchtower";

export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await getCurrentUser();
  const canCommand = isCommandRank(user?.rank);

  return (
    <AppShell>
      <Watchtower canCommand={canCommand} />
    </AppShell>
  );
}
