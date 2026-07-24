"use client";

import { useCallback, useEffect, useState } from "react";

interface Plan {
  id: string;
  title: string;
  body: string;
  type: string;
  priority: string;
  createdAt: string | number | Date;
  author: string;
  authorRank: string;
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

function time(d: string | number | Date) {
  return new Date(d).toLocaleString("hr-HR", { dateStyle: "short", timeStyle: "short" });
}

export default function PlansClient({ canWrite }: { canWrite: boolean }) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [type, setType] = useState("zapovijed");
  const [priority, setPriority] = useState("NORMALNO");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/plans");
    if (res.ok) setPlans((await res.json()).plans ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/plans", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, body, type, priority })
      });
      if (res.ok) {
        setTitle("");
        setBody("");
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
        <form onSubmit={submit} className="panel panel-pad" style={{ marginBottom: 18 }}>
          <label className="field">
            <span className="lbl">Naslov</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={120} />
          </label>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <label className="field" style={{ flex: 1, minWidth: 140 }}>
              <span className="lbl">Tip</span>
              <select value={type} onChange={(e) => setType(e.target.value)}>
                <option value="zapovijed">Danasnja zapovijed</option>
                <option value="plan">Plan</option>
                <option value="program">Program</option>
              </select>
            </label>
            <label className="field" style={{ flex: 1, minWidth: 140 }}>
              <span className="lbl">Prioritet</span>
              <select value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="HITNO">HITNO</option>
                <option value="VISOKO">VISOKO</option>
                <option value="NORMALNO">NORMALNO</option>
                <option value="NISKO">NISKO</option>
              </select>
            </label>
          </div>
          <label className="field">
            <span className="lbl">Sadrzaj</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              maxLength={8000}
              style={{ minHeight: 160 }}
              placeholder="Detaljna zapovijed / plan / program..."
            />
          </label>
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
              <div className="plan-body">{p.body}</div>
              <div className="plan-foot">
                <span>
                  {p.author} · {time(p.createdAt)}
                </span>
                {canWrite && (
                  <button className="linkish" onClick={() => del(p.id)}>
                    Obrisi
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
