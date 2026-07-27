"use client";

import { useCallback, useEffect, useState } from "react";
import Dropdown from "@/components/Dropdown";
import Help from "@/components/Help";

interface UserRow {
  id: string;
  callsign: string;
  rank: string;
  status: string;
  hasPassword: boolean;
  lastLoginAt: string | number | Date | null;
}

interface InviteRow {
  id: string;
  code: string;
  intendedCallsign: string | null;
  note: string | null;
  usedBy: string | null;
  expiresAt: string | number | Date;
  createdAt: string | number | Date;
}

type Tab = "korisnici" | "pozivnice" | "jedinice";

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
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [muInput, setMuInput] = useState("");
  const [tracked, setTracked] = useState<{ muId: string; label?: string | null }[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [intended, setIntended] = useState("");
  const [note, setNote] = useState("");
  const [lastCode, setLastCode] = useState<string | null>(null);
  const [discordMsg, setDiscordMsg] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    const r = await fetch("/api/admin/users");
    if (r.ok) setUsers((await r.json()).users ?? []);
  }, []);

  const loadMus = useCallback(async () => {
    const r = await fetch("/api/warera/units");
    if (r.ok) {
      const data = await r.json();
      setTracked((data.units ?? []).map((u: { id: string; name: string }) => ({ muId: u.id, label: u.name })));
    }
  }, []);

  const loadInvites = useCallback(async () => {
    const r = await fetch("/api/admin/invites");
    if (r.ok) setInvites((await r.json()).invites ?? []);
  }, []);

  useEffect(() => {
    loadUsers();
    loadMus();
    loadInvites();
  }, [loadUsers, loadMus, loadInvites]);

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

  async function createInvite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/admin/invites", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          intendedCallsign: intended || undefined,
          note: note || undefined
        })
      });
      const data = await r.json();
      if (!r.ok) {
        setMsg(data.error ?? "Greska");
        return;
      }
      setLastCode(data.invite.code);
      setDiscordMsg(data.invite.discordMsg);
      setIntended("");
      setNote("");
      await loadInvites();
    } finally {
      setBusy(false);
    }
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
    setMsg("Skeniram...");
    try {
      const r = await fetch("/api/warera/units", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ discover: true })
      });
      const data = await r.json();
      setMsg(
        r.ok
          ? `Pronadeno ${data.found}: ${(data.names ?? []).join(", ")}`
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
        <button className={tab === "pozivnice" ? "active" : ""} onClick={() => setTab("pozivnice")}>
          Pozivnice
        </button>
        <button className={tab === "jedinice" ? "active" : ""} onClick={() => setTab("jedinice")}>
          Jedinice
        </button>
      </div>

      {tab === "korisnici" && (
        <div className="panel table-scroll">
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
                    {u.rank === "admin" ? (
                      <span className="rank-tag">Admin</span>
                    ) : (
                      <Dropdown
                        value={u.rank}
                        onChange={(v) => userAction(u.id, "rank", v)}
                        options={[
                          { value: "visoki", label: "Visoki zapovjednik" },
                          { value: "zapovjednik", label: "Zapovjednik" },
                          { value: "vojnik", label: "Vojnik" }
                        ]}
                      />
                    )}
                  </td>
                  <td className="muted">{dt(u.lastLoginAt)}</td>
                  <td>
                    <div className="row-actions">
                      {u.status !== "aktivan" && (
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => userAction(u.id, "status", "aktivan")}
                          disabled={busy}
                        >
                          Odobri
                        </button>
                      )}
                      {u.status !== "blokiran" ? (
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => userAction(u.id, "status", "blokiran")}
                          disabled={busy}
                        >
                          Blokiraj
                        </button>
                      ) : (
                        <button
                          className="btn btn-sm"
                          onClick={() => userAction(u.id, "status", "aktivan")}
                          disabled={busy}
                        >
                          Deblokiraj
                        </button>
                      )}
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => deleteUser(u.id)}
                        disabled={busy}
                      >
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

      {tab === "pozivnice" && (
        <div className="panel panel-pad">
          <div className="lbl" style={{ marginBottom: 8 }}>
            Nova pozivnica <Help text="Svaki kod je jedinstven i radi samo jednom. Vezanje za pozivni znak sprecava da netko drugi iskoristi tvoj Discord DM." />
          </div>
          <form onSubmit={createInvite} className="invite-form">
            <input
              value={intended}
              onChange={(e) => setIntended(e.target.value)}
              placeholder="Pozivni znak (opcionalno, preporuceno)"
            />
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Discord nick / biljeska"
            />
            <button className="btn btn-primary" disabled={busy}>
              Generiraj kod
            </button>
          </form>
          {lastCode && (
            <div className="notice ok">
              Kod: <span className="mono">{lastCode}</span>
              <button
                className="btn btn-sm"
                style={{ marginLeft: 10 }}
                onClick={() => {
                  if (discordMsg) navigator.clipboard.writeText(discordMsg);
                }}
              >
                Kopiraj Discord poruku
              </button>
            </div>
          )}
          {msg && <div className="notice">{msg}</div>}
          <div className="table-scroll" style={{ marginTop: 14 }}>
            <table className="grid">
              <thead>
                <tr>
                  <th>Kod</th>
                  <th>Za</th>
                  <th>Status</th>
                  <th>Istice</th>
                </tr>
              </thead>
              <tbody>
                {invites.map((i) => (
                  <tr key={i.id}>
                    <td className="mono">{i.code}</td>
                    <td>{i.intendedCallsign ?? i.note ?? "—"}</td>
                    <td>{i.usedBy ? `iskoristio ${i.usedBy}` : "slobodan"}</td>
                    <td className="muted">{dt(i.expiresAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "jedinice" && (
        <div className="panel panel-pad">
          {msg && <div className="notice">{msg}</div>}
          <form onSubmit={addMu} className="invite-form">
            <input
              value={muInput}
              onChange={(e) => setMuInput(e.target.value)}
              placeholder="MU ID ili link"
            />
            <button className="btn btn-primary">Dodaj</button>
            <button type="button" className="btn" onClick={discoverMus} disabled={busy}>
              {busy ? "Skeniram..." : "Skeniraj"}
            </button>
          </form>
          <div className="table-scroll" style={{ marginTop: 14 }}>
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
          </div>
          {tracked.length === 0 && <div className="empty">Nema pracenih jedinica</div>}
        </div>
      )}
    </div>
  );
}
