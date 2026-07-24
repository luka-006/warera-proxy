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

export default function UnitsClient() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
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

  return (
    <div>
      <div className="section-head">
        <h1>Vojne jedinice</h1>
        <button className="btn btn-sm" onClick={() => load()}>
          Osvjezi
        </button>
      </div>

      {message && <div className="notice">{message}</div>}
      {loading && units.length === 0 && <div className="empty">Ucitavanje jedinica...</div>}
      {!loading && units.length === 0 && !message && (
        <div className="empty">Nema pracenih jedinica</div>
      )}

      <div className="unit-list">
        {units.map((u) => {
          const open = openId === u.id;
          return (
            <article key={u.id} className="unit-card">
              <div className="unit-head">
                <a href={u.link} target="_blank" rel="noreferrer" className="unit-brand">
                  <Avatar url={u.avatarUrl} name={u.name} size={48} />
                  <div>
                    <div className="unit-name">{u.name}</div>
                    <div className="unit-meta">
                      {u.memberCount} clanova
                      {u.weeklyRank ? ` · tjedni rang #${u.weeklyRank}` : ""}
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

              {u.commanders.length > 0 && (
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
                <div className="unit-section">
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
