"use client";

import { useCallback, useEffect, useState } from "react";
import Dropdown from "@/components/Dropdown";

interface Phase {
  title: string;
  when: string;
  body: string;
}

interface Plan {
  id: string;
  title: string;
  body: string;
  type: string;
  priority: string;
  phases: Phase[];
  battleId: string | null;
  battleLabel: string | null;
  battleLink: string | null;
  reactions: Record<string, number>;
  myReactions: string[];
  createdAt: string | number | Date;
  author: string;
  authorRank: string;
}

interface BattleOpt {
  id: string;
  label: string;
  regionName?: string;
}

const PRIO_COLOR: Record<string, string> = {
  HITNO: "var(--prio-hitno)",
  VISOKO: "var(--prio-visoko)",
  NORMALNO: "var(--prio-normalno)",
  NISKO: "var(--prio-nisko)"
};

const TYPE_LABEL: Record<string, string> = {
  zapovijed: "Danasnja zapovijed",
  plan: "Plan",
  program: "Program"
};

const EMOJIS = ["🫡", "❤️", "👍"];

function time(d: string | number | Date) {
  return new Date(d).toLocaleString("hr-HR", { dateStyle: "short", timeStyle: "short" });
}

export default function PlansClient({ canWrite }: { canWrite: boolean }) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [battles, setBattles] = useState<BattleOpt[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [type, setType] = useState("zapovijed");
  const [priority, setPriority] = useState("NORMALNO");
  const [battleId, setBattleId] = useState("");
  const [phases, setPhases] = useState<Phase[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/plans");
    if (res.ok) setPlans((await res.json()).plans ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Aktivne bitke za izbornik (samo kad se otvori forma)
  useEffect(() => {
    if (!open || battles.length) return;
    fetch("/api/warera/battles")
      .then((r) => r.json())
      .then((d) => {
        const list = (d.battles ?? []).map((b: any) => ({
          id: b.id,
          label: b.label,
          regionName: b.regionName
        }));
        setBattles(list);
      })
      .catch(() => {});
  }, [open, battles.length]);

  function updatePhase(i: number, patch: Partial<Phase>) {
    setPhases((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const battle = battles.find((b) => b.id === battleId);
      const res = await fetch("/api/plans", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          body,
          type,
          priority,
          battleId: battleId || undefined,
          battleLabel: battle?.label,
          phases: phases.filter((p) => p.title.trim() || p.body.trim())
        })
      });
      if (res.ok) {
        setTitle("");
        setBody("");
        setPhases([]);
        setBattleId("");
        setOpen(false);
        await load();
      }
    } finally {
      setSaving(false);
    }
  }

  async function del(id: string) {
    if (!confirm("Obrisati ovaj zapis?")) return;
    await fetch(`/api/plans?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await load();
  }

  async function react(plan: Plan, emoji: string) {
    // optimisticki toggle
    setPlans((prev) =>
      prev.map((p) => {
        if (p.id !== plan.id) return p;
        const mine = p.myReactions.includes(emoji);
        const counts = { ...p.reactions };
        counts[emoji] = Math.max(0, (counts[emoji] ?? 0) + (mine ? -1 : 1));
        return {
          ...p,
          reactions: counts,
          myReactions: mine
            ? p.myReactions.filter((e) => e !== emoji)
            : [...p.myReactions, emoji]
        };
      })
    );
    await fetch("/api/plans/reactions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ planId: plan.id, emoji })
    }).catch(() => {});
  }

  const battleOptions = [
    { value: "", label: "Bez bitke" },
    ...battles.map((b) => ({
      value: b.id,
      label: b.label,
      hint: b.regionName
    }))
  ];

  return (
    <div>
      <div className="section-head">
        <h1>Plan i program</h1>
        {canWrite && (
          <button className="btn btn-primary btn-sm" onClick={() => setOpen((v) => !v)}>
            {open ? "Zatvori" : "Nova zapovijed"}
          </button>
        )}
      </div>

      <p className="muted" style={{ marginTop: -8, marginBottom: 16 }}>
        Zapovjedi, planovi i programi za sve hrvatske jedinice. Vojnici citaju; zapovjednici i admin
        objavljuju.
      </p>

      {canWrite && open && (
        <form onSubmit={submit} className="panel panel-pad reveal" style={{ marginBottom: 18 }}>
          <label className="field">
            <span className="lbl">Naslov</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={120} />
          </label>
          <div className="form-row">
            <label className="field">
              <span className="lbl">Tip</span>
              <Dropdown
                value={type}
                onChange={setType}
                options={[
                  { value: "zapovijed", label: "Danasnja zapovijed" },
                  { value: "plan", label: "Plan" },
                  { value: "program", label: "Program" }
                ]}
              />
            </label>
            <label className="field">
              <span className="lbl">Prioritet</span>
              <Dropdown
                value={priority}
                onChange={setPriority}
                options={[
                  { value: "HITNO", label: "HITNO", color: PRIO_COLOR.HITNO },
                  { value: "VISOKO", label: "VISOKO", color: PRIO_COLOR.VISOKO },
                  { value: "NORMALNO", label: "NORMALNO", color: PRIO_COLOR.NORMALNO },
                  { value: "NISKO", label: "NISKO", color: PRIO_COLOR.NISKO }
                ]}
              />
            </label>
            <label className="field" style={{ flex: 2 }}>
              <span className="lbl">Aktivna bitka (direktan link)</span>
              <Dropdown
                value={battleId}
                onChange={setBattleId}
                options={battleOptions}
                placeholder="Bez bitke"
              />
            </label>
          </div>
          <label className="field">
            <span className="lbl">Sadrzaj</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              maxLength={8000}
              style={{ minHeight: 140 }}
              placeholder="Sto ce se dogoditi, kako se krecemo, sto ocekujemo..."
            />
          </label>

          <div className="phase-builder">
            <div className="phase-builder-head">
              <span className="lbl">Faze plana (opcionalno)</span>
              {phases.length < 12 && (
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setPhases((p) => [...p, { title: "", when: "", body: "" }])}
                >
                  + Dodaj fazu
                </button>
              )}
            </div>
            {phases.map((ph, i) => (
              <div key={i} className="phase-edit reveal">
                <div className="phase-edit-top">
                  <span className="phase-num">FAZA {i + 1}</span>
                  <input
                    value={ph.title}
                    onChange={(e) => updatePhase(i, { title: e.target.value })}
                    placeholder="Naziv faze (npr. Proboj na sjeveru)"
                    maxLength={80}
                  />
                  <input
                    value={ph.when}
                    onChange={(e) => updatePhase(i, { when: e.target.value })}
                    placeholder="Kada (npr. subota 20:00)"
                    maxLength={60}
                    className="phase-when"
                  />
                  <button
                    type="button"
                    className="linkish"
                    onClick={() => setPhases((p) => p.filter((_, idx) => idx !== i))}
                  >
                    ukloni
                  </button>
                </div>
                <textarea
                  value={ph.body}
                  onChange={(e) => updatePhase(i, { body: e.target.value })}
                  placeholder="Sto se radi u ovoj fazi, sto ocekivati..."
                  maxLength={1500}
                />
              </div>
            ))}
          </div>

          <button className="btn btn-primary" disabled={saving}>
            {saving ? "Spremanje..." : "Objavi"}
          </button>
        </form>
      )}

      {plans.length === 0 ? (
        <div className="empty">Nema objava</div>
      ) : (
        <div className="plan-list">
          {plans.map((p) => (
            <article
              key={p.id}
              className="plan-card"
              style={{ borderLeftColor: PRIO_COLOR[p.priority] ?? "var(--line-strong)" }}
            >
              <div className="plan-head">
                <span className="prio-chip" style={{ color: PRIO_COLOR[p.priority] }}>
                  {p.priority}
                </span>
                <span className="type-chip">{TYPE_LABEL[p.type] ?? p.type}</span>
                <h2>{p.title}</h2>
              </div>

              {p.battleLink && (
                <a href={p.battleLink} target="_blank" rel="noreferrer" className="plan-battle">
                  ⚔ {p.battleLabel ?? "Otvori bitku"} <span className="arrow">↗</span>
                </a>
              )}

              <div className="plan-body">{p.body}</div>

              {p.phases.length > 0 && (
                <div className="phase-timeline">
                  {p.phases.map((ph, i) => (
                    <div key={i} className="phase">
                      <div className="phase-rail">
                        <span className="phase-dot">{i + 1}</span>
                        {i < p.phases.length - 1 && <span className="phase-line" />}
                      </div>
                      <div className="phase-content">
                        <div className="phase-title">
                          {ph.title || `Faza ${i + 1}`}
                          {ph.when && <span className="phase-when-chip">{ph.when}</span>}
                        </div>
                        {ph.body && <div className="phase-body">{ph.body}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="plan-foot">
                <div className="react-row">
                  {EMOJIS.map((e) => {
                    const count = p.reactions[e] ?? 0;
                    const mine = p.myReactions.includes(e);
                    return (
                      <button
                        key={e}
                        className={`react-btn ${mine ? "on" : ""}`}
                        onClick={() => react(p, e)}
                        title={mine ? "Makni reakciju" : "Reagiraj"}
                      >
                        {e}
                        {count > 0 && <span className="react-count">{count}</span>}
                      </button>
                    );
                  })}
                </div>
                <span className="plan-meta">
                  {p.author} · {time(p.createdAt)}
                  {canWrite && (
                    <button className="linkish" onClick={() => del(p.id)}>
                      Obrisi
                    </button>
                  )}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
