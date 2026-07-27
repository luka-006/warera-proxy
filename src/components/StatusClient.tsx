"use client";

import { useCallback, useEffect, useState } from "react";
import Help from "@/components/Help";
import { RANK_SHORT } from "@/lib/ranks";
import { avatarStyle, initials } from "@/lib/avatar";

interface StatusRow {
  userId: string;
  callsign: string;
  rank: string;
  avatarHue: number | null;
  health: string;
  helpMsg: string | null;
  updatedAt: string | number | Date | null;
}

const HEALTH_OPTS = [
  { value: "spreman", label: "Spreman", color: "var(--olive-bright)" },
  { value: "zauzet", label: "Zauzet", color: "var(--amber)" },
  { value: "ozlijeden", label: "Ozlijeden", color: "var(--danger-bright)" },
  { value: "odsutan", label: "Odsutan", color: "var(--ink-faint)" }
];

function healthMeta(h: string) {
  return HEALTH_OPTS.find((o) => o.value === h) ?? HEALTH_OPTS[0];
}

export default function StatusClient({ myId }: { myId: string }) {
  const [rows, setRows] = useState<StatusRow[]>([]);
  const [health, setHealth] = useState("spreman");
  const [helpMsg, setHelpMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/status");
    if (!r.ok) return;
    const d = await r.json();
    const list: StatusRow[] = d.statuses ?? [];
    setRows(list);
    const me = list.find((x) => x.userId === myId);
    if (me) {
      setHealth(me.health);
      setHelpMsg(me.helpMsg ?? "");
    }
  }, [myId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  async function save(nextHealth = health, nextHelp: string | null = helpMsg || null) {
    setSaving(true);
    try {
      await fetch("/api/status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ health: nextHealth, helpMsg: nextHelp })
      });
      await load();
    } finally {
      setSaving(false);
    }
  }

  const needingHelp = rows.filter((r) => r.helpMsg);

  return (
    <div>
      <div className="section-head">
        <h1>Status postrojbe</h1>
        <div className="head-actions">
          <Help text="Oznaci jesi li spreman, zauzet, ozlijeden ili odsutan. Zahtjev za pomoc salje obavijest cijeloj postrojbi." />
        </div>
      </div>

      <div className="panel panel-pad status-mine">
        <div className="lbl">Moj status</div>
        <div className="health-pills">
          {HEALTH_OPTS.map((o) => (
            <button
              key={o.value}
              type="button"
              className={`health-pill ${health === o.value ? "on" : ""}`}
              style={{ color: o.color, borderColor: health === o.value ? o.color : undefined }}
              onClick={() => {
                setHealth(o.value);
                save(o.value, helpMsg || null);
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
        <div className="help-bar">
          <input
            value={helpMsg}
            onChange={(e) => setHelpMsg(e.target.value)}
            placeholder="Zahtjev za pomoc (opcionalno)..."
            maxLength={160}
          />
          <button
            className="btn btn-primary btn-sm"
            disabled={saving || !helpMsg.trim()}
            onClick={() => save(health, helpMsg.trim())}
          >
            Posalji
          </button>
          {helpMsg && (
            <button
              className="btn btn-sm"
              onClick={() => {
                setHelpMsg("");
                save(health, null);
              }}
            >
              Makni
            </button>
          )}
        </div>
      </div>

      {needingHelp.length > 0 && (
        <div className="help-requests reveal">
          <div className="lbl">Aktivni zahtjevi za pomoc</div>
          {needingHelp.map((r) => (
            <div key={r.userId} className="help-req">
              <span className="avatar-circle sm" style={avatarStyle(r.callsign, r.avatarHue)}>
                {initials(r.callsign)}
              </span>
              <div>
                <b>{r.callsign}</b>
                <div className="muted">{r.helpMsg}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="status-list">
        {rows.map((r) => {
          const meta = healthMeta(r.health);
          return (
            <div key={r.userId} className="status-row">
              <span className="avatar-circle" style={avatarStyle(r.callsign, r.avatarHue)}>
                {initials(r.callsign)}
              </span>
              <div className="status-info">
                <div className="status-name">
                  {r.callsign}
                  <span className="rk">{RANK_SHORT[r.rank] ?? ""}</span>
                </div>
                {r.helpMsg && <div className="status-help">{r.helpMsg}</div>}
              </div>
              <span className="health-tag" style={{ color: meta.color, borderColor: meta.color }}>
                {meta.label}
              </span>
            </div>
          );
        })}
        {rows.length === 0 && <div className="empty">Nema aktivnih igraca</div>}
      </div>
    </div>
  );
}
