"use client";

import { useCallback, useEffect, useState } from "react";

interface UserRow {
  id: string;
  callsign: string;
  rank: string;
  status: string;
  canChat: boolean;
  hasPassword: boolean;
  createdAt: string | number | Date;
  lastLoginAt: string | number | Date | null;
}
interface RequestRow {
  id: string;
  callsign: string;
  rank: string;
  createdAt: string | number | Date;
}
interface ChannelRow {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
}

type Tab = "korisnici" | "zahtjevi" | "kanali";

function statusClass(s: string) {
  return `status-pill status-${s}`;
}
function dt(d: string | number | Date | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("hr-HR", { dateStyle: "short", timeStyle: "short" });
}

export default function AdminClient() {
  const [tab, setTab] = useState<Tab>("korisnici");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [channels, setChannels] = useState<ChannelRow[]>([]);
  const [newChannel, setNewChannel] = useState("");
  const [busy, setBusy] = useState(false);

  const loadUsers = useCallback(async () => {
    const r = await fetch("/api/admin/users");
    if (r.ok) setUsers((await r.json()).users ?? []);
  }, []);
  const loadRequests = useCallback(async () => {
    const r = await fetch("/api/admin/requests");
    if (r.ok) setRequests((await r.json()).requests ?? []);
  }, []);
  const loadChannels = useCallback(async () => {
    const r = await fetch("/api/admin/channels");
    if (r.ok) setChannels((await r.json()).channels ?? []);
  }, []);

  useEffect(() => {
    loadUsers();
    loadRequests();
    loadChannels();
  }, [loadUsers, loadRequests, loadChannels]);

  async function userAction(userId: string, action: string, value: unknown) {
    setBusy(true);
    try {
      await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId, action, value })
      });
      await loadUsers();
    } finally {
      setBusy(false);
    }
  }

  async function deleteUser(userId: string) {
    if (!confirm("Obrisati korisnika? Ova radnja je trajna.")) return;
    await fetch(`/api/admin/users?userId=${encodeURIComponent(userId)}`, { method: "DELETE" });
    await loadUsers();
  }

  async function resolveRequest(requestId: string, approve: boolean) {
    await fetch("/api/admin/requests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requestId, approve })
    });
    await Promise.all([loadRequests(), loadUsers()]);
  }

  async function addChannel(e: React.FormEvent) {
    e.preventDefault();
    if (!newChannel.trim()) return;
    const r = await fetch("/api/admin/channels", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: newChannel })
    });
    if (r.ok) {
      setNewChannel("");
      await loadChannels();
    }
  }

  async function deleteChannel(id: string) {
    if (!confirm("Obrisati kanal i sve poruke u njemu?")) return;
    await fetch(`/api/admin/channels?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await loadChannels();
  }

  return (
    <div>
      <div className="section-head">
        <h1>Zapovjedno sucelje</h1>
        <span className="meta">{users.length} racuna · {requests.length} zahtjeva</span>
      </div>

      <div className="tabs">
        <button className={tab === "korisnici" ? "active" : ""} onClick={() => setTab("korisnici")}>
          Korisnici
        </button>
        <button className={tab === "zahtjevi" ? "active" : ""} onClick={() => setTab("zahtjevi")}>
          Zahtjevi ({requests.length})
        </button>
        <button className={tab === "kanali" ? "active" : ""} onClick={() => setTab("kanali")}>
          Kanali
        </button>
      </div>

      {tab === "korisnici" && (
        <div className="panel">
          <table className="grid">
            <thead>
              <tr>
                <th>Pozivni znak</th>
                <th>Status</th>
                <th>Rang</th>
                <th>Chat</th>
                <th>Zadnja prijava</th>
                <th>Akcije</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="mono">
                    {u.callsign}
                    {!u.hasPassword && <span className="muted"> (fraza)</span>}
                  </td>
                  <td>
                    <span className={statusClass(u.status)}>{u.status}</span>
                  </td>
                  <td>
                    <select
                      value={u.rank}
                      onChange={(e) => userAction(u.id, "rank", e.target.value)}
                      style={{ width: "auto" }}
                      disabled={busy}
                    >
                      <option value="admin">admin</option>
                      <option value="zapovjednik">zapovjednik</option>
                      <option value="vojnik">vojnik</option>
                    </select>
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={u.canChat || u.rank !== "vojnik"}
                      disabled={u.rank !== "vojnik" || busy}
                      onChange={(e) => userAction(u.id, "chat", e.target.checked)}
                      style={{ width: "auto" }}
                    />
                  </td>
                  <td className="muted">{dt(u.lastLoginAt)}</td>
                  <td>
                    <div className="row-actions">
                      {u.status !== "aktivan" && (
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => userAction(u.id, "status", "aktivan")}
                        >
                          Odobri
                        </button>
                      )}
                      {u.status !== "blokiran" ? (
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => userAction(u.id, "status", "blokiran")}
                        >
                          Blokiraj
                        </button>
                      ) : (
                        <button
                          className="btn btn-sm"
                          onClick={() => userAction(u.id, "status", "aktivan")}
                        >
                          Deblokiraj
                        </button>
                      )}
                      <button className="btn btn-sm btn-danger" onClick={() => deleteUser(u.id)}>
                        Obrisi
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && <div className="empty">Nema korisnika</div>}
        </div>
      )}

      {tab === "zahtjevi" && (
        <div className="panel">
          {requests.length === 0 ? (
            <div className="empty">Nema zahtjeva za pisanje</div>
          ) : (
            <table className="grid">
              <thead>
                <tr>
                  <th>Pozivni znak</th>
                  <th>Rang</th>
                  <th>Podneseno</th>
                  <th>Akcije</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id}>
                    <td className="mono">{r.callsign}</td>
                    <td>{r.rank}</td>
                    <td className="muted">{dt(r.createdAt)}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => resolveRequest(r.id, true)}
                        >
                          Odobri pisanje
                        </button>
                        <button
                          className="btn btn-sm"
                          onClick={() => resolveRequest(r.id, false)}
                        >
                          Odbij
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "kanali" && (
        <div className="panel panel-pad">
          <form onSubmit={addChannel} style={{ display: "flex", gap: 10, marginBottom: 18 }}>
            <input
              value={newChannel}
              onChange={(e) => setNewChannel(e.target.value)}
              placeholder="Naziv novog kanala (npr. Jedinica Alfa)"
            />
            <button className="btn btn-primary">Dodaj kanal</button>
          </form>
          <table className="grid">
            <thead>
              <tr>
                <th>Kanal</th>
                <th>Naziv</th>
                <th>Akcije</th>
              </tr>
            </thead>
            <tbody>
              {channels.map((c) => (
                <tr key={c.id}>
                  <td className="mono">#{c.slug}</td>
                  <td>{c.name}</td>
                  <td>
                    <button className="btn btn-sm btn-danger" onClick={() => deleteChannel(c.id)}>
                      Obrisi
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {channels.length === 0 && <div className="empty">Nema kanala</div>}
        </div>
      )}
    </div>
  );
}
