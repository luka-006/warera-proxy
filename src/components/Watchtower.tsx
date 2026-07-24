"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface BattleSide {
  countryId?: string;
  name?: string;
  countryCode?: string;
  damage?: number;
  points?: number;
}
interface Battle {
  id: string;
  label: string;
  attacker: BattleSide;
  defender: BattleSide;
  regionName?: string;
  round?: number;
  roundsToWin?: number;
  totalDamage?: number;
  type?: string;
  link: string;
}
interface Note {
  id: string;
  battleId: string;
  body: string;
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

function flagUrl(code?: string): string | null {
  if (!code || code.length !== 2) return null;
  return `https://flagcdn.com/w40/${code.toLowerCase()}.png`;
}

function Flag({ side }: { side: BattleSide }) {
  const url = flagUrl(side.countryCode);
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="flag" src={url} alt={side.name ?? ""} />;
  }
  return (
    <span className="flag-fallback">{(side.countryCode ?? "??").slice(0, 2).toUpperCase()}</span>
  );
}

function fmt(n?: number): string {
  if (n === undefined || n === null) return "—";
  return new Intl.NumberFormat("hr-HR").format(Math.round(n));
}

function timeAgo(d: string | number | Date): string {
  const t = new Date(d).getTime();
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return "upravo";
  if (s < 3600) return `prije ${Math.floor(s / 60)} min`;
  if (s < 86400) return `prije ${Math.floor(s / 3600)} h`;
  return new Date(d).toLocaleDateString("hr-HR");
}

export default function Watchtower({ canCommand }: { canCommand: boolean }) {
  const [battles, setBattles] = useState<Battle[]>([]);
  const [notes, setNotes] = useState<Record<string, Note[]>>({});
  const [configured, setConfigured] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadNotes = useCallback(async (ids: string[]) => {
    if (!ids.length) {
      setNotes({});
      return;
    }
    try {
      const res = await fetch(`/api/notes?battleIds=${encodeURIComponent(ids.join(","))}`);
      if (res.ok) {
        const data = await res.json();
        setNotes(data.notes ?? {});
      }
    } catch {
      /* tiho */
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/warera/battles");
      const data = await res.json();
      setConfigured(data.configured !== false);
      if (data.error) setError(data.error);
      else setError(null);
      const list: Battle[] = data.battles ?? [];
      setBattles(list);
      setFetchedAt(data.fetchedAt ?? new Date().toISOString());
      await loadNotes(list.map((b) => b.id).filter(Boolean));
    } catch {
      setError("Greska u dohvatu podataka.");
    } finally {
      setLoading(false);
    }
  }, [loadNotes]);

  useEffect(() => {
    load();
    timer.current = setInterval(load, 45_000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [load]);

  function onNoteAdded(battleId: string, note: Note) {
    setNotes((prev) => ({ ...prev, [battleId]: [note, ...(prev[battleId] ?? [])] }));
  }
  function onNoteDeleted(battleId: string, noteId: string) {
    setNotes((prev) => ({
      ...prev,
      [battleId]: (prev[battleId] ?? []).filter((n) => n.id !== noteId)
    }));
  }

  return (
    <div>
      <div className="section-head">
        <h1>Nadzorna ploca</h1>
        <span className="meta">
          {loading
            ? "ucitavanje..."
            : fetchedAt
              ? `azurirano ${new Date(fetchedAt).toLocaleTimeString("hr-HR")}`
              : ""}
        </span>
      </div>

      {!configured && (
        <div className="notice">
          War Era API kljuc nije postavljen. Postavi <span className="mono">WARERA_API_KEY</span>{" "}
          u okruzenju za prikaz uzivo. Biljeske zapovjednika i dalje rade.
        </div>
      )}
      {error && <div className="notice err">{error}</div>}

      {!loading && battles.length === 0 ? (
        <div className="empty">
          {configured ? "Nema aktivnih bitaka" : "Cekanje na konfiguraciju API-ja"}
        </div>
      ) : (
        battles.map((b) => (
          <BattleCard
            key={b.id}
            battle={b}
            notes={notes[b.id] ?? []}
            canCommand={canCommand}
            onAdded={(n) => onNoteAdded(b.id, n)}
            onDeleted={(id) => onNoteDeleted(b.id, id)}
          />
        ))
      )}
    </div>
  );
}

function BattleCard({
  battle,
  notes,
  canCommand,
  onAdded,
  onDeleted
}: {
  battle: Battle;
  notes: Note[];
  canCommand: boolean;
  onAdded: (n: Note) => void;
  onDeleted: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState("NORMALNO");
  const [saving, setSaving] = useState(false);

  const attDmg = battle.attacker.damage ?? 0;
  const defDmg = battle.defender.damage ?? 0;
  const total = attDmg + defDmg;
  const attPct = total > 0 ? (attDmg / total) * 100 : 50;

  // Najvisi prioritet biljeske odreduje boju lijeve crte kartice
  const topPrio = notes.reduce<string>((acc, n) => {
    const order = ["NISKO", "NORMALNO", "VISOKO", "HITNO"];
    return order.indexOf(n.priority) > order.indexOf(acc) ? n.priority : acc;
  }, "");
  const borderColor = topPrio ? PRIO_COLOR[topPrio] : "var(--line-strong)";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          battleId: battle.id,
          battleLabel: battle.label,
          body,
          priority
        })
      });
      const data = await res.json();
      if (res.ok) {
        onAdded(data.note);
        setBody("");
        setPriority("NORMALNO");
        setOpen(false);
      }
    } finally {
      setSaving(false);
    }
  }

  async function del(id: string) {
    const res = await fetch(`/api/notes?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.ok) onDeleted(id);
  }

  return (
    <div className="battle" style={{ borderLeftColor: borderColor }}>
      <div className="battle-row">
        <div className="battle-main">
          <Flag side={battle.attacker} />
          <a href={battle.link} target="_blank" rel="noreferrer" className="battle-title">
            {battle.attacker.name ?? "Napadac"}
          </a>
          <span className="vs">vs</span>
          <a href={battle.link} target="_blank" rel="noreferrer" className="battle-title">
            {battle.defender.name ?? "Branitelj"}
          </a>
          <Flag side={battle.defender} />
        </div>

        <div className="battle-meta">
          {battle.regionName && (
            <span>
              <span className="k">regija</span> {battle.regionName}
            </span>
          )}
          {battle.round !== undefined && (
            <span>
              <span className="k">runda</span> {battle.round}
              {battle.roundsToWin ? `/${battle.roundsToWin}` : ""}
            </span>
          )}
          {(battle.attacker.points !== undefined || battle.defender.points !== undefined) && (
            <span>
              <span className="k">bodovi</span> {battle.attacker.points ?? 0}:
              {battle.defender.points ?? 0}
            </span>
          )}
          <span>
            <span className="k">steta</span> {fmt(total)}
          </span>
        </div>

        <div className="damage-bar" title={`${fmt(attDmg)} / ${fmt(defDmg)}`}>
          <div className="att" style={{ width: `${attPct}%` }} />
          <div className="def" style={{ width: `${100 - attPct}%` }} />
        </div>
      </div>

      {notes.length > 0 && (
        <div className="notes">
          {notes.map((n) => (
            <div className="note" key={n.id}>
              <span
                className="bar"
                style={{ background: PRIO_COLOR[n.priority] ?? "var(--line-strong)" }}
              />
              <div className="body">
                <span
                  className="prio-chip"
                  style={{ color: PRIO_COLOR[n.priority] ?? "var(--ink-faint)", marginRight: 8 }}
                >
                  {n.priority}
                </span>
                {n.body}
                <div className="who">
                  {n.author} · {timeAgo(n.createdAt)}
                  {canCommand && (
                    <button
                      onClick={() => del(n.id)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--danger-bright)",
                        cursor: "pointer",
                        marginLeft: 10,
                        fontSize: 10,
                        letterSpacing: "0.1em",
                        textTransform: "uppercase"
                      }}
                    >
                      ukloni
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {canCommand &&
        (open ? (
          <form onSubmit={submit} style={{ padding: "10px 16px 14px" }}>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Uputa / zapovijed za ovu bitku (npr. svi na obranu, ne ulaziti...)"
              autoFocus
              maxLength={500}
            />
            <div
              style={{ display: "flex", gap: 10, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}
            >
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                style={{ width: "auto" }}
              >
                <option value="HITNO">HITNO</option>
                <option value="VISOKO">VISOKO</option>
                <option value="NORMALNO">NORMALNO</option>
                <option value="NISKO">NISKO</option>
              </select>
              <button className="btn btn-primary btn-sm" disabled={saving}>
                {saving ? "..." : "Objavi biljesku"}
              </button>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setOpen(false)}
              >
                Odustani
              </button>
            </div>
          </form>
        ) : (
          <button className="add-note" onClick={() => setOpen(true)}>
            <span className="plus">+</span> Dodaj biljesku zapovjednika
          </button>
        ))}
    </div>
  );
}
