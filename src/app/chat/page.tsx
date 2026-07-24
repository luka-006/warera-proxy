import AppShell from "@/components/AppShell";
import { getCurrentUser } from "@/lib/session";
import ChatClient from "@/components/ChatClient";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const user = await getCurrentUser();
  const canWrite =
    user?.rank === "admin" || user?.rank === "zapovjednik" || user?.canChat === true;
  const isSoldier = user?.rank === "vojnik";

  return (
    <AppShell>
      <ChatClient
        canWrite={canWrite}
        isSoldier={isSoldier}
        me={user?.callsign ?? ""}
      />
    </AppShell>
  );
}
