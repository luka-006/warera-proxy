"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Help from "@/components/Help";
import { RANK_SHORT, rankOutlineClass, isCommandRank } from "@/lib/ranks";
import { avatarStyle, initials } from "@/lib/avatar";

interface LiveHealth {
  current: number;
  max: number;
  percent: number;
  debuff: boolean;
}

interface StatusRow {
  userId: string;
  callsign: string;
  rank: string;
  avatarHue: number | null;
  mode: string;
  modeLabel: string;
  liveHealth: LiveHealth | null;
  updatedAt: string | number | Date | null;
}

const MODES = [
  { value: "spreman", label: "War mode", color: "var(--olive-bright)" },
  { value: "odsutan", label: "Eco mode", color: "var(--ink-faint)" }
] as const;

type ModeFilter = "all" | "spreman" | "odsutan";

function LiveHpBar({ live }: { live: LiveHealth | null }) {
  if (!live) {
    return <span className="live-hp unknown">HP n/a</span>;
  }
  const color =
    live.percent >= 80 ? "var(--olive-bright)" : live.percent >= 40 ? "var(--amber)" : "var(--danger-bright)";
  return (
    <div className="live-hp">
      <div className="live-hp-top">
        <span className="live-dot" />
        <span className="live-hp-label">LIVE HP</span>
        <span className="live-hp-val" style={{ color }}>
          {live.current}/{live.max} ({live.percent}%)
        </span>
        {live.debuff && <span className="live-debuff">debuff</span>}
      </div>
      <div className="live-hp-bar">
        <span className="live-hp-fill" style={{ width: `${live.percent}%`, background: color }} />
      </div>
    </div>
  );
}

export default function StatusClient({ myId, myRank }: { myId: string; myRank: string }) {
  const canSeeRoster = isCommandRank(myRank);
  const [rows, setRows] = useState<StatusRow[]>([]);
  const [mode, setMode] = useState("spreman");
  const [filter, setFilter] = useState<ModeFilter>("all");
  const [liveOk, setLiveOk] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastFetch, setLastFetch] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/status", { cache: "no-store" });
    if (!r.ok) return;
    const d = await r.json();
    const list: StatusRow[] = d.statuses ?? [];
    setRows(list);
    setLiveOk(Boolean(d.live));
    setLastFetch(d.fetchedAt ?? new Date().toISOString());
    const me = list.find((x) => x.userId === myId);
    if (me) setMode(me.mode === "odsutan" ? "odsutan" : "spreman");
  }, [myId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 8_000);
    return () => clearInterval(t);
  }, [load]);

  async function save(nextMode: string) {
    setSaving(true);
    try {
      await fetch("/api/status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: nextMode })
      });
      setMode(nextMode);
      await load();
    } finally {
      setSaving(false);
    }
  }

  const filtered = useMemo(() => {
    if (filter === "all") return rows;
    return rows.filter((r) => r.mode === filter);
  }, [rows, filter]);

  const debuffs = rows.filter((r) => r.liveHealth?.debuff);

  return (
    <div>
      <div className="section-head">
        <h1>Status postrojbe</h1>
        <div className="head-actions">
          <Help text="War/Eco mode biras pri prijavi i ovdje. LIVE HP dolazi iz War Era (pozivni znak = username). Osvjezava se svakih 8s." />
          {liveOk && <span className="live-badge">LIVE</span>}
        </div>
      </div>

      <div className="panel panel-pad status-mine">
        <div className="lbl">Moj mod</div>
        <div className="health-pills">
          {MODES.map((o) => (
            <button
              key={o.value}
              type="button"
              className={`health-pill ${mode === o.value ? "on" : ""}`}
              style={{ color: o.color, borderColor: mode === o.value ? o.color : undefined }}
              disabled={saving}
              onClick={() => save(o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
        {(() => {
          const me = rows.find((r) => r.userId === myId);
          return me ? <LiveHpBar live={me.liveHealth} /> : null;
        })()}
      </div>

      {canSeeRoster && (
        <div className="board-toolbar" style={{ marginTop: 14 }}>
          <div className="board-filters">
            {(
              [
                ["all", "Svi"],
                ["spreman", "War mode"],
                ["odsutan", "Eco mode"]
              ] as const
            ).map(([k, lbl]) => (
              <button
                key={k}
                type="button"
                className={`filter-chip ${filter === k ? "on" : ""}`}
                onClick={() => setFilter(k)}
              >
                {lbl}
              </button>
            ))}
          </div>
          {lastFetch && (
            <span className="muted" style={{ fontSize: 11 }}>
              Osvjezeno {new Date(lastFetch).toLocaleTimeString("hr-HR")}
            </span>
          )}
        </div>
      )}

      {canSeeRoster && debuffs.length > 0 && (
        <div className="help-requests reveal">
          <div className="lbl">Debuff (live War Era)</div>
          {debuffs.map((r) => (
            <div key={r.userId} className="help-req">
              <span className="avatar-circle sm" style={avatarStyle(r.callsign, r.avatarHue)}>
                {initials(r.callsign)}
              </span>
              <div>
                <b>{r.callsign}</b>
                <div className="muted">
                  HP {r.liveHealth?.percent ?? "?"}%
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {canSeeRoster ? (
        <div className="status-list">
          {filtered.map((r) => (
            <div key={r.userId} className={`status-row ${rankOutlineClass(r.rank)}`}>
              <span className="avatar-circle" style={avatarStyle(r.callsign, r.avatarHue)}>
                {initials(r.callsign)}
              </span>
              <div className="status-info">
                <div className="status-name">
                  {r.callsign}
                  <span className={`rk ${rankOutlineClass(r.rank)}`}>{RANK_SHORT[r.rank] ?? ""}</span>
                </div>
                <LiveHpBar live={r.liveHealth} />
              </div>
              <span
                className="health-tag"
                style={{
                  color: r.mode === "odsutan" ? "var(--ink-faint)" : "var(--olive-bright)",
                  borderColor: r.mode === "odsutan" ? "var(--ink-faint)" : "var(--olive-bright)"
                }}
              >
                {r.modeLabel}
              </span>
            </div>
          ))}
          {filtered.length === 0 && <div className="empty">Nema igraca za filter</div>}
        </div>
      ) : (
        <div className="notice" style={{ marginTop: 14 }}>
          Cjeloviti popis statusa vidi zapovjednistvo (Zapovjednik / General).
        </div>
      )}
    </div>
  );
}