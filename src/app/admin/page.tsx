import AppShell from "@/components/AppShell";
import AdminClient from "@/components/AdminClient";

export const dynamic = "force-dynamic";

export default function AdminPage() {
  return (
    <AppShell requireAdmin>
      <AdminClient />
    </AppShell>
  );
}
