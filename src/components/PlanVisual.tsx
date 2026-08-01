"use client";

import { useEffect, useMemo, useState } from "react";
import { MuChipRow, type PlanMu } from "@/components/MuChips";
import { GearChipRow } from "@/components/GearChips";
import { formatQuarterHourShort } from "@/components/QuarterHourPicker";
import { REGION_TOKEN_RE } from "@/lib/tags";

interface Phase {
  title: string;
  when: string;
  body: string;
  mus?: PlanMu[];
  region?: { id: string; name: string; link: string };
}

interface AttackTime {
  at: string;
  label: string;
}

interface PlanVisualPlan {
  id: string;
  title: string;
  body: string;
  expect: string;
  priority: string;
  attackTimes: AttackTime[];
  phases: Phase[];
  gear: string[];
  mus: PlanMu[];
  battleLabel: string | null;
  battleLink: string | null;
}

type RegionPin = { id: string; name: string; link: string };

function parseRegions(text: string): RegionPin[] {
  const found = new Map<string, RegionPin>();
  for (const m of text.matchAll(REGION_TOKEN_RE)) {
    found.set(m[1], { id: m[1], name: m[2], link: m[3] });
  }
  return [...found.values()];
}

function parseTime(v: string): number {
  if (!v) return Number.NaN;
  const d = v.includes("T") ? new Date(v) : new Date(`${new Date().toISOString().slice(0, 10)}T${v}`);
  return d.getTime();
}

export default function PlanVisual({
  plan,
  avatarMap,
  onClose
}: {
  plan: PlanVisualPlan;
  avatarMap: Map<string, string>;
  onClose: () => void;
}) {
  const [regions, setRegions] = useState<RegionPin[]>([]);

  const embedded = useMemo(() => {
    const fromBody = parseRegions(plan.body);
    const fromPhases = plan.phases.flatMap((ph) =>
      ph.region ? [ph.region] : parseRegions(ph.body)
    );
    const map = new Map<string, RegionPin>();
    for (const r of [...fromBody, ...fromPhases]) map.set(r.id, r);
    return [...map.values()];
  }, [plan]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/warera/regions")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const all: { id: string; name: string; link: string }[] = d.regions ?? [];
        const ids = new Set(embedded.map((r) => r.id));
        const extra = all.filter((r) => ids.has(r.id));
        const map = new Map<string, RegionPin>();
        for (const r of [...embedded, ...extra]) map.set(r.id, r);
        setRegions([...map.values()]);
      })
      .catch(() => setRegions(embedded));
    return () => {
      cancelled = true;
    };
  }, [embedded]);

  const timeline = useMemo(() => {
    const items: {
      key: string;
      sort: number;
      time: string;
      title: string;
      detail?: string;
      mus?: PlanMu[];
      kind: "attack" | "phase";
    }[] = [];

    for (const t of plan.attackTimes) {
      const sort = parseTime(t.at);
      if (Number.isNaN(sort)) continue;
      items.push({
        key: `atk-${t.at}-${t.label}`,
        sort,
        time: t.at,
        title: t.label || "Napad",
        kind: "attack"
      });
    }

    for (const ph of plan.phases) {
      const sort = parseTime(ph.when);
      items.push({
        key: `ph-${ph.title}-${ph.when}`,
        sort: Number.isNaN(sort) ? Date.now() + items.length : sort,
        time: ph.when,
        title: ph.title || "Faza",
        detail: ph.body,
        mus: ph.mus,
        kind: "phase"
      });
    }

    return items.sort((a, b) => a.sort - b.sort);
  }, [plan]);

  return (
    <div className="plan-visual-backdrop" role="presentation" onClick={onClose}>
      <div
        className="plan-visual-panel reveal"
        role="dialog"
        aria-labelledby="plan-visual-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="plan-visual-head">
          <div>
            <div className="plan-visual-tag">VIDI PLAN</div>
            <h2 id="plan-visual-title">{plan.title}</h2>
            <div className="plan-visual-meta">
              {plan.priority}
              {plan.battleLabel && (
                <>
                  {" · "}
                  {plan.battleLink ? (
                    <a href={plan.battleLink} target="_blank" rel="noreferrer">
                      {plan.battleLabel}
                    </a>
                  ) : (
                    plan.battleLabel
                  )}
                </>
              )}
            </div>
          </div>
          <button type="button" className="btn btn-sm" onClick={onClose}>
            Zatvori
          </button>
        </div>

        <div className="plan-visual-body">
          <section className="plan-visual-map">
            <div className="lbl">Zone / regije</div>
            {regions.length === 0 ? (
              <div className="plan-visual-empty">
                Nema oznacenih zona. Zapovjednik ubaci mjesto u plan ili fazu.
              </div>
            ) : (
              <div className="plan-visual-zones">
                {regions.map((r) => (
                  <a
                    key={r.id}
                    href={r.link}
                    target="_blank"
                    rel="noreferrer"
                    className="plan-zone-card"
                  >
                    <span className="plan-zone-outline" />
                    <span className="plan-zone-name">{r.name}</span>
                  </a>
                ))}
              </div>
            )}
            {plan.mus.length > 0 && (
              <div className="plan-visual-mus">
                <div className="lbl">Jedinice u planu</div>
                <MuChipRow mus={plan.mus} avatarMap={avatarMap} />
              </div>
            )}
          </section>

          <section className="plan-visual-timeline">
            <div className="lbl">Raspored (15 min koraci)</div>
            {timeline.length === 0 ? (
              <div className="plan-visual-empty">Nema vremena ni faza.</div>
            ) : (
              <div className="plan-visual-steps">
                {timeline.map((item) => (
                  <div key={item.key} className={`plan-visual-step ${item.kind}`}>
                    <div className="plan-visual-step-time">
                      {item.time ? formatQuarterHourShort(item.time) : "—"}
                    </div>
                    <div className="plan-visual-step-dot" />
                    <div className="plan-visual-step-card">
                      <div className="plan-visual-step-title">{item.title}</div>
                      {item.detail && <div className="plan-visual-step-body">{item.detail}</div>}
                      {item.mus && item.mus.length > 0 && (
                        <MuChipRow mus={item.mus} avatarMap={avatarMap} />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {plan.gear.length > 0 && (
              <div className="plan-visual-gear">
                <GearChipRow gear={plan.gear} />
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}