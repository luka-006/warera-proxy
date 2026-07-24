import AppShell from "@/components/AppShell";
import ChatClient from "@/components/ChatClient";
import { getCurrentUser } from "@/lib/session";
import { isCommandRank } from "@/lib/ranks";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const user = await getCurrentUser();
  const allowed = isCommandRank(user?.rank);

  return (
    <AppShell>
      {allowed ? (
        <ChatClient />
      ) : (
        <div>
          <div className="section-head">
            <h1>Zapovjedni kanal</h1>
          </div>
          <div className="empty">Pristup ima samo zapovjednistvo</div>
        </div>
      )}
    </AppShell>
  );
}
