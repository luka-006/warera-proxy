"use client";

import { useCallback, useEffect, useState } from "react";
import Help from "@/components/Help";
import { RANK_SHORT, rankOutlineClass, isCommandRank } from "@/lib/ranks";
import { avatarStyle, initials } from "@/lib/avatar";

interface StatusRow {
  userId: string;
  callsign: string;
  rank: string;
  avatarHue: number | null;
  health: string;
  updatedAt: string | number | Date | null;
}

const CLICKABLE = [
  { value: "spreman", label: "Spreman", color: "var(--olive-bright)" },
  { value: "zauzet", label: "Zauzet", color: "var(--amber)" },
  { value: "odsutan", label: "Odsutan", color: "var(--ink-faint)" }
];

const ALL_META = [
  ...CLICKABLE,
  { value: "debuff", label: "Debuff", color: "var(--danger-bright)" }
];

function healthMeta(h: string) {
  const n = h === "ozlijeden" ? "debuff" : h;
  return ALL_META.find((o) => o.value === n) ?? CLICKABLE[0];
}

export default function StatusClient({
  myId,
  myRank
}: {
  myId: string;
  myRank: string;
}) {
  const canSeeRoster = isCommandRank(myRank);
  const [rows, setRows] = useState<StatusRow[]>([]);
  const [health, setHealth] = useState("spreman");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/status");
    if (!r.ok) return;
    const d = await r.json();
    const list: StatusRow[] = d.statuses ?? [];
    setRows(list);
    const me = list.find((x) => x.userId === myId);
    if (me) {
      const h = me.health === "debuff" || me.health === "ozlijeden" ? "spreman" : me.health;
      setHealth(CLICKABLE.some((c) => c.value === h) ? h : "spreman");
    }
  }, [myId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  async function save(nextHealth: string) {
    setSaving(true);
    try {
      await fetch("/api/status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ health: nextHealth })
      });
      setHealth(nextHealth);
      await load();
    } finally {
      setSaving(false);
    }
  }

  const debuffs = rows.filter((r) => r.health === "debuff" || r.health === "ozlijeden");

  return (
    <div>
      <div className="section-head">
        <h1>Status postrojbe</h1>
        <div className="head-actions">
          <Help text="Oznaci jesi li spreman, zauzet ili odsutan. Debuff app dohvaca automatski i vidi ga samo zapovjednistvo." />
        </div>
      </div>

      <div className="panel panel-pad status-mine">
        <div className="lbl">Moj status</div>
        <div className="health-pills">
          {CLICKABLE.map((o) => (
            <button
              key={o.value}
              type="button"
              className={`health-pill ${health === o.value ? "on" : ""}`}
              style={{ color: o.color, borderColor: health === o.value ? o.color : undefined }}
              disabled={saving}
              onClick={() => save(o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {canSeeRoster && debuffs.length > 0 && (
        <div className="help-requests reveal">
          <div className="lbl">Debuff (automatski)</div>
          {debuffs.map((r) => (
            <div key={r.userId} className="help-req">
              <span className="avatar-circle sm" style={avatarStyle(r.callsign, r.avatarHue)}>
                {initials(r.callsign)}
              </span>
              <div>
                <b>{r.callsign}</b>
                <div className="muted">Debuff</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {canSeeRoster ? (
        <div className="status-list">
          {rows.map((r) => {
            const meta = healthMeta(r.health);
            return (
              <div key={r.userId} className={`status-row ${rankOutlineClass(r.rank)}`}>
                <span className="avatar-circle" style={avatarStyle(r.callsign, r.avatarHue)}>
                  {initials(r.callsign)}
                </span>
                <div className="status-info">
                  <div className="status-name">
                    {r.callsign}
                    <span className={`rk ${rankOutlineClass(r.rank)}`}>
                      {RANK_SHORT[r.rank] ?? ""}
                    </span>
                  </div>
                </div>
                <span className="health-tag" style={{ color: meta.color, borderColor: meta.color }}>
                  {meta.label}
                </span>
              </div>
            );
          })}
          {rows.length === 0 && <div className="empty">Nema aktivnih igraca</div>}
        </div>
      ) : (
        <div className="notice" style={{ marginTop: 14 }}>
          Cjeloviti popis statusa vidi zapovjednistvo (Zapovjednik / General).
        </div>
      )}
    </div>
  );
}