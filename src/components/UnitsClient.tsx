"use client";

import { useCallback, useEffect, useState } from "react";

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

function MemberRow({ m }: { m: Member }) {
  return (
    <a href={m.link} target="_blank" rel="noreferrer" className="member-row">
      <Avatar url={m.avatarUrl} name={m.username} size={28} />
      <span className="member-name">{m.username}</span>
      {m.isCommander && <span className="role-tag">zapovjednik</span>}
      {m.isManager && !m.isCommander && <span className="role-tag">manager</span>}
      {m.level !== undefined && <span className="member-meta">Lv {m.level}</span>}
    </a>
  );
}

export default function UnitsClient({ isAdmin = false }: { isAdmin?: boolean }) {
  const [units, setUnits] = useState<Unit[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [discovering, setDiscovering] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/warera/units");
      const data = await res.json();
      setUnits(data.units ?? []);
      setMessage(data.message ?? data.error ?? null);
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
    setMessage("Skeniram War Era ljestvicu za HR/KG jedinice...");
    try {
      const res = await fetch("/api/warera/units", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ discover: true })
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`Pronadeno ${data.found} jedinica: ${(data.names ?? []).join(", ")}`);
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

  return (
    <div>
      <div className="section-head">
        <h1>Vojne jedinice</h1>
        <div className="head-actions">
          {isAdmin && (
            <button className="btn btn-sm" onClick={discover} disabled={discovering}>
              {discovering ? "Skeniram..." : "Pronadi HR/KG jedinice"}
            </button>
          )}
          <button className="btn btn-sm" onClick={() => load()}>
            Osvjezi
          </button>
        </div>
      </div>

      <p className="muted" style={{ marginTop: -8, marginBottom: 16 }}>
        Hrvatske jedinice i jedinice Kirgistana (proxy drzava Hrvatske).
      </p>

      {message && <div className="notice">{message}</div>}
      {loading && units.length === 0 && <div className="empty">Ucitavanje jedinica...</div>}
      {!loading && units.length === 0 && !message && (
        <div className="empty">Nema pracenih jedinica</div>
      )}

      <div className="unit-list">
        {units.map((u) => {
          const open = openId === u.id;
          const dmg = fmtDamage(u.weeklyDamage);
          return (
            <article key={u.id} className="unit-card">
              <div className="unit-head">
                <a href={u.link} target="_blank" rel="noreferrer" className="unit-brand">
                  <Avatar url={u.avatarUrl} name={u.name} size={48} />
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
                </a>
                <div className="unit-actions">
                  <a href={u.link} target="_blank" rel="noreferrer" className="btn btn-sm">
                    War Era
                  </a>
                  <button className="btn btn-sm" onClick={() => setOpenId(open ? null : u.id)}>
                    {open ? "Sakrij" : "Clanovi"}
                  </button>
                </div>
              </div>

              {u.commanders.length + u.managers.length > 0 && (
                <div className="unit-section">
                  <div className="unit-section-lbl">Zapovjednistvo</div>
                  <div className="member-list">
                    {[...u.commanders, ...u.managers].map((m) => (
                      <MemberRow key={m.id} m={m} />
                    ))}
                  </div>
                </div>
              )}

              {open && (
                <div className="unit-section reveal">
                  <div className="unit-section-lbl">Vojnici</div>
                  <div className="member-list">
                    {u.soldiers.length === 0 ? (
                      <span className="muted">Nema prikazanih vojnika</span>
                    ) : (
                      u.soldiers.map((m) => <MemberRow key={m.id} m={m} />)
                    )}
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
