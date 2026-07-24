import AppShell from "@/components/AppShell";
import UnitsClient from "@/components/UnitsClient";

export const dynamic = "force-dynamic";

export default function JedinicePage() {
  return (
    <AppShell>
      <UnitsClient />
    </AppShell>
  );
}
