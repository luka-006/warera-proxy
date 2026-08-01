"use client";

import { useCallback, useEffect, useState } from "react";
import Help from "@/components/Help";

interface Member {
  id: string;
  username: string;
  avatarUrl?: string;
  link: string;
  isCommander: boolean;
  isManager: boolean;
  militaryRank?: number;
  level?: number;
}
interface Unit {
  id: string;
  name: string;
  avatarUrl?: string;
  link: string;
  countryCode?: string;
  countryName?: string;
  memberCount: number;
  commanders: Member[];
  managers: Member[];
  soldiers: Member[];
  weeklyDamage?: number;
  weeklyRank?: number;
}

function Avatar({ url, name, size = 36 }: { url?: string; name: string; size?: number }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={url}
        alt={name}
        className="mu-avatar"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span className="mu-avatar fallback" style={{ width: size, height: size }}>
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}

function fmtDamage(n?: number) {
  if (!n) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

function MemberRow({
  m,
  canCommand,
  muName,
  onPing
}: {
  m: Member;
  canCommand: boolean;
  muName: string;
  onPing: (m: Member, muName: string) => void;
}) {
  return (
    <div className="member-row-wrap">
      <a href={m.link} target="_blank" rel="noreferrer" className="member-row">
        <Avatar url={m.avatarUrl} name={m.username} size={28} />
        <span className="member-name">{m.username}</span>
        {m.isCommander && <span className="role-tag">zapovjednik</span>}
        {m.isManager && !m.isCommander && <span className="role-tag">manager</span>}
        {m.level !== undefined && <span className="member-meta">Lv {m.level}</span>}
      </a>
      {canCommand && (
        <button
          type="button"
          className="btn btn-sm ping-member"
          title={`Ping ${m.username}`}
          onClick={() => onPing(m, muName)}
        >
          PING
        </button>
      )}
    </div>
  );
}

export default function UnitsClient({
  isAdmin = false,
  canCommand = false
}: {
  isAdmin?: boolean;
  canCommand?: boolean;
}) {
  const [units, setUnits] = useState<Unit[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [discovering, setDiscovering] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [membersByMu, setMembersByMu] = useState<
    Record<
      string,
      {
        commanders: Member[];
        managers: Member[];
        soldiers: Member[];
        loading?: boolean;
        error?: string;
      }
    >
  >({});
  const [q, setQ] = useState("");
  const [pinging, setPinging] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/warera/units");
      const data = await res.json();
      setUnits(data.units ?? []);
      const total = data.total ?? data.units?.length ?? 0;
      const extra =
        data.catalog && data.catalog !== total
          ? ` (${total} prikazano, ${data.catalog} u katalogu)`
          : total
            ? ` (${total} jedinica)`
            : "";
      setMessage(
        data.message ?? data.error ?? (total ? `Ucitano${extra}` : null)
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 90_000);
    return () => clearInterval(t);
  }, [load]);

  async function discover() {
    setDiscovering(true);
    setMessage("Skeniram...");
    try {
      const res = await fetch("/api/warera/units", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ discover: true })
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`Pronadeno ${data.found}: ${(data.names ?? []).join(", ")}`);
        await load();
      } else {
        setMessage(data.error ?? "Otkrivanje nije uspjelo.");
      }
    } catch {
      setMessage("Otkrivanje nije uspjelo.");
    } finally {
      setDiscovering(false);
    }
  }

  async function pingMember(m: Member, muName: string) {
    const key = m.id;
    setPinging(key);
    try {
      const r = await fetch("/api/ping", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetCallsign: m.username,
          message: `Order za ${m.username} (${muName})`
        })
      });
      const d = await r.json().catch(() => ({}));
      setMessage(r.ok ? `Ping poslan: ${m.username}` : d.error ?? "Ping nije uspio.");
    } finally {
      setPinging(null);
    }
  }

  async function pingMu(u: Unit) {
    setPinging(u.id);
    try {
      const r = await fetch("/api/ping", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          muId: u.id,
          muName: u.name,
          message: `Order za cijelu MU ${u.name}`
        })
      });
      const d = await r.json().catch(() => ({}));
      setMessage(r.ok ? `Ping poslan MU: ${u.name}` : d.error ?? "Ping nije uspio.");
    } finally {
      setPinging(null);
    }
  }

  async function toggleMembers(u: Unit) {
    if (openId === u.id) {
      setOpenId(null);
      return;
    }
    setOpenId(u.id);
    if (membersByMu[u.id] || u.commanders.length + u.managers.length + u.soldiers.length > 0) {
      return;
    }
    setMembersByMu((prev) => ({
      ...prev,
      [u.id]: { commanders: [], managers: [], soldiers: [], loading: true }
    }));
    try {
      const res = await fetch(`/api/warera/units/members?muId=${encodeURIComponent(u.id)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Greska");
      setMembersByMu((prev) => ({
        ...prev,
        [u.id]: {
          commanders: data.commanders ?? [],
          managers: data.managers ?? [],
          soldiers: data.soldiers ?? [],
          loading: false
        }
      }));
    } catch (e) {
      setMembersByMu((prev) => ({
        ...prev,
        [u.id]: {
          commanders: [],
          managers: [],
          soldiers: [],
          loading: false,
          error: e instanceof Error ? e.message : "Clanovi nisu ucitani."
        }
      }));
    }
  }

  function membersFor(u: Unit) {
    const cached = membersByMu[u.id];
    if (cached) return cached;
    return {
      commanders: u.commanders,
      managers: u.managers,
      soldiers: u.soldiers
    };
  }

  const query = q.trim().toLowerCase();
  const visible = query
    ? units.filter((u) => u.name.toLowerCase() === query || u.name.toLowerCase().includes(query))
    : units;
  const sorted = query
    ? [...visible].sort((a, b) => {
        const ae = a.name.toLowerCase() === query ? 0 : 1;
        const be = b.name.toLowerCase() === query ? 0 : 1;
        return ae - be;
      })
    : visible;

  return (
    <div>
      <div className="section-head">
        <h1>Vojne jedinice</h1>
        <div className="head-actions">
          <Help text="PING na clanu ili cijeloj MU salje order obavijest. Skeniranje pronalazi jedinice." />
          {isAdmin && (
            <button className="btn btn-sm" onClick={discover} disabled={discovering}>
              {discovering ? "Skeniram..." : "Skeniraj"}
            </button>
          )}
          <button className="btn btn-sm" onClick={() => load()}>
            Osvjezi
          </button>
        </div>
      </div>

      <div className="board-toolbar">
        <input
          className="board-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Pretrazi jedinicu po imenu..."
        />
      </div>

      {message && <div className="notice">{message}</div>}
      {loading && units.length === 0 && <div className="empty">Ucitavanje jedinica...</div>}
      {!loading && sorted.length === 0 && <div className="empty">Nema pogodaka</div>}

      <div className="unit-list">
        {sorted.map((u) => {
          const open = openId === u.id;
          const dmg = fmtDamage(u.weeklyDamage);
          const mem = membersFor(u);
          const staff = [...mem.commanders, ...mem.managers];
          return (
            <article key={u.id} className={`unit-card ${open ? "open" : ""}`}>
              <div className="unit-head">
                <div className="unit-brand">
                  <a
                    href={u.link}
                    target="_blank"
                    rel="noreferrer"
                    className="mu-logo-btn"
                    title="Otvori u War Era"
                  >
                    <Avatar url={u.avatarUrl} name={u.name} size={48} />
                  </a>
                  <div className="unit-brand-txt">
                    <div className="unit-name">
                      {u.countryCode && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          className="flag sm"
                          src={`https://flagcdn.com/w40/${u.countryCode.toLowerCase()}.png`}
                          alt={u.countryName ?? u.countryCode}
                          title={u.countryName}
                        />
                      )}
                      {u.name}
                    </div>
                    <div className="unit-meta">
                      {u.memberCount} clanova
                      {u.weeklyRank ? ` · rang #${u.weeklyRank}` : ""}
                      {dmg ? ` · ${dmg} tjedna steta` : ""}
                    </div>
                  </div>
                </div>
                <div className="unit-actions">
                  {canCommand && (
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      disabled={pinging === u.id}
                      onClick={() => pingMu(u)}
                      title="Ping cijele MU"
                    >
                      {pinging === u.id ? "..." : "PING MU"}
                    </button>
                  )}
                  <button className="btn btn-sm" onClick={() => toggleMembers(u)}>
                    {open ? "Sakrij" : "Clanovi"}
                  </button>
                </div>
              </div>

              {open && (
                <div className="unit-section expand-panel">
                  {mem.loading && <div className="muted">Ucitavanje clanova...</div>}
                  {mem.error && <div className="notice">{mem.error}</div>}
                  {!mem.loading && staff.length > 0 && (
                    <>
                      <div className="unit-section-lbl">Zapovjednistvo</div>
                      <div className="member-list">
                        {staff.map((m) => (
                          <MemberRow
                            key={m.id}
                            m={m}
                            canCommand={canCommand}
                            muName={u.name}
                            onPing={pingMember}
                          />
                        ))}
                      </div>
                    </>
                  )}
                  {!mem.loading && (
                    <>
                      <div className="unit-section-lbl">Vojnici</div>
                      <div className="member-list">
                        {mem.soldiers.length === 0 ? (
                          <span className="muted">
                            {mem.error ? "—" : "Nema prikazanih vojnika"}
                          </span>
                        ) : (
                          mem.soldiers.map((m) => (
                            <MemberRow
                              key={m.id}
                              m={m}
                              canCommand={canCommand}
                              muName={u.name}
                              onPing={pingMember}
                            />
                          ))
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}