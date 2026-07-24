import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import Nav from "./Nav";

// Server komponenta: cuva rutu, prosljeduje korisnika u shell.
export default async function AppShell({
  children,
  requireAdmin = false
}: {
  children: React.ReactNode;
  requireAdmin?: boolean;
}) {
  const user = await getCurrentUser();

  if (!user) redirect("/prijava");
  if (user.status !== "aktivan") {
    // Prijavljen ali ceka odobrenje
    return (
      <div className="app-shell">
        <div className="auth-wrap">
          <div className="auth-card">
            <div className="brand" style={{ justifyContent: "center" }}>
              <span className="dot" />
              WARERA<span className="sub">HR OPS</span>
            </div>
            <div className="auth-title">Cekanje odobrenja</div>
            <div className="notice">
              Pozivni znak <span className="mono">{user.callsign}</span> ceka
              odobrenje administratora. Javit ce ti se kad racun bude aktiviran.
            </div>
            <form action="/api/auth/logout" method="post">
              <a className="btn" href="/prijava" style={{ display: "block", textAlign: "center" }}>
                Natrag na prijavu
              </a>
            </form>
          </div>
        </div>
      </div>
    );
  }
  if (requireAdmin && user.rank !== "admin") redirect("/");

  return (
    <div className="app-shell">
      <Nav callsign={user.callsign} rank={user.rank} />
      <main className="content">{children}</main>
    </div>
  );
}
