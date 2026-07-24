import AppShell from "@/components/AppShell";
import { getCurrentUser } from "@/lib/session";
import Watchtower from "@/components/Watchtower";

export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await getCurrentUser();
  const canCommand = user?.rank === "admin" || user?.rank === "zapovjednik";

  return (
    <AppShell>
      <Watchtower canCommand={canCommand} />
    </AppShell>
  );
}
