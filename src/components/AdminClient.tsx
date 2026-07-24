"use client";

import { useCallback, useEffect, useState } from "react";

interface UserRow {
  id: string;
  callsign: string;
  rank: string;
  status: string;
  hasPassword: boolean;
  lastLoginAt: string | number | Date | null;
}

type Tab = "korisnici" | "jedinice";

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
  const [muInput, setMuInput] = useState("");
  const [tracked, setTracked] = useState<{ muId: string; label?: string | null }[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    const r = await fetch("/api/admin/users");
    if (r.ok) setUsers((await r.json()).users ?? []);
  }, []);

  const loadMus = useCallback(async () => {
    // tracked list via units endpoint + POST/DELETE; we store ids in DB
    // use a lightweight list by fetching units (which also returns empty if none)
    const r = await fetch("/api/warera/units");
    if (r.ok) {
      const data = await r.json();
      setTracked((data.units ?? []).map((u: { id: string; name: string }) => ({ muId: u.id, label: u.name })));
    }
  }, []);

  useEffect(() => {
    loadUsers();
    loadMus();
  }, [loadUsers, loadMus]);

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
    if (!confirm("Obrisati korisnika?")) return;
    await fetch(`/api/admin/users?userId=${encodeURIComponent(userId)}`, { method: "DELETE" });
    await loadUsers();
  }

  async function addMu(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const r = await fetch("/api/warera/units", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ muIdOrUrl: muInput })
    });
    const data = await r.json();
    if (!r.ok) {
      setMsg(data.error ?? "Greska");
      return;
    }
    setMuInput("");
    setMsg(`Dodano: ${data.muId}`);
    await loadMus();
  }

  async function removeMu(muId: string) {
    await fetch(`/api/warera/units?muId=${encodeURIComponent(muId)}`, { method: "DELETE" });
    await loadMus();
  }

  async function discoverMus() {
    setBusy(true);
    setMsg("Skeniram War Era ljestvicu za HR/KG jedinice...");
    try {
      const r = await fetch("/api/warera/units", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ discover: true })
      });
      const data = await r.json();
      setMsg(
        r.ok
          ? `Pronadeno ${data.found} jedinica: ${(data.names ?? []).join(", ")}`
          : data.error ?? "Otkrivanje nije uspjelo."
      );
      await loadMus();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="section-head">
        <h1>Zapovjedno sucelje</h1>
        <span className="meta">{users.length} racuna</span>
      </div>

      <div className="tabs">
        <button className={tab === "korisnici" ? "active" : ""} onClick={() => setTab("korisnici")}>
          Korisnici
        </button>
        <button className={tab === "jedinice" ? "active" : ""} onClick={() => setTab("jedinice")}>
          Vojne jedinice
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
                <th>Prijava</th>
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

      {tab === "jedinice" && (
        <div className="panel panel-pad">
          <p className="muted" style={{ marginTop: 0 }}>
            Dodaj hrvatske vojne jedinice (MU) iz War Ere — ID ili link tipa{" "}
            <span className="mono">app.warera.io/mu/...</span>
          </p>
          {msg && <div className="notice">{msg}</div>}
          <form onSubmit={addMu} style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
            <input
              value={muInput}
              onChange={(e) => setMuInput(e.target.value)}
              placeholder="MU ID ili link"
              style={{ flex: 1, minWidth: 200 }}
            />
            <button className="btn btn-primary">Dodaj</button>
            <button type="button" className="btn" onClick={discoverMus} disabled={busy}>
              {busy ? "Skeniram..." : "Pronadi HR/KG jedinice"}
            </button>
          </form>
          <table className="grid">
            <thead>
              <tr>
                <th>Naziv</th>
                <th>ID</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tracked.map((t) => (
                <tr key={t.muId}>
                  <td>{t.label ?? "—"}</td>
                  <td className="mono muted">{t.muId}</td>
                  <td>
                    <button className="btn btn-sm btn-danger" onClick={() => removeMu(t.muId)}>
                      Ukloni
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {tracked.length === 0 && <div className="empty">Nema pracenih jedinica</div>}
        </div>
      )}
    </div>
  );
}
