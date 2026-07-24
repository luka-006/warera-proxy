"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Dropdown from "@/components/Dropdown";
import Help from "@/components/Help";

interface MuContract {
  id: string;
  name: string;
  avatarUrl?: string;
  link: string;
}
interface BattleSide {
  countryId?: string;
  name?: string;
  countryCode?: string;
  damage?: number;
  points?: number;
  link?: string;
  bountyPer1k?: number;
  bountyPool?: number;
  contracts?: MuContract[];
}
interface Battle {
  id: string;
  label: string;
  attacker: BattleSide;
  defender: BattleSide;
  regionId?: string;
  regionName?: string;
  regionLink?: string;
  round?: number;
  roundsToWin?: number;
  totalDamage?: number;
  link: string;
}
interface Note {
  id: string;
  battleId: string;
  body: string;
  priority: string;
  createdAt: string | number | Date;
  author: string;
}
interface Pin {
  battleId: string;
  weight: number;
}
interface Assignment {
  muId: string;
  muName: string;
}
interface TrackedUnit {
  muId: string;
  label: string | null;
}

const PRIO_COLOR: Record<string, string> = {
  HITNO: "var(--prio-hitno)",
  VISOKO: "var(--prio-visoko)",
  NORMALNO: "var(--prio-normalno)",
  NISKO: "var(--prio-nisko)"
};

// P1 najvisi prioritet
const PIN_COLOR: Record<number, string> = {
  1: "var(--prio-hitno)",
  2: "var(--prio-visoko)",
  3: "var(--prio-normalno)",
  4: "var(--prio-nisko)"
};

function flagUrl(code?: string) {
  if (!code || code.length !== 2) return null;
  return `https://flagcdn.com/w40/${code.toLowerCase()}.png`;
}

function Ext({
  href,
  className,
  title,
  children,
  stop
}: {
  href?: string;
  className?: string;
  title?: string;
  children: React.ReactNode;
  stop?: boolean;
}) {
  if (!href) return <span className={className}>{children}</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={className}
      title={title}
      onClick={stop ? (e) => e.stopPropagation() : undefined}
    >
      {children}
    </a>
  );
}

function Flag({ side }: { side: BattleSide }) {
  const url = flagUrl(side.countryCode);
  const el = url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="flag" src={url} alt={side.name ?? ""} />
  ) : (
    <span className="flag-fallback">{(side.countryCode ?? "??").slice(0, 2).toUpperCase()}</span>
  );
  return (
    <Ext href={side.link} className="flag-link" title={side.name} stop>
      {el}
    </Ext>
  );
}

function timeAgo(d: string | number | Date) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "upravo";
  if (s < 3600) return `prije ${Math.floor(s / 60)} min`;
  if (s < 86400) return `prije ${Math.floor(s / 3600)} h`;
  return new Date(d).toLocaleDateString("hr-HR");
}

function money(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toFixed(n < 10 ? 2 : 0);
}

export default function Watchtower({ canCommand }: { canCommand: boolean }) {
  const [battles, setBattles] = useState<Battle[]>([]);
  const [notes, setNotes] = useState<Record<string, Note[]>>({});
  const [pins, setPins] = useState<Record<string, number>>({});
  const [assignments, setAssignments] = useState<Record<string, Assignment[]>>({});
  const [units, setUnits] = useState<TrackedUnit[]>([]);
  const [configured, setConfigured] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const [bRes, pRes, aRes] = await Promise.all([
        fetch("/api/warera/battles"),
        fetch("/api/pins"),
        fetch("/api/assignments")
      ]);
      const bData = await bRes.json();
      const pData = pRes.ok ? await pRes.json() : { pins: [] };
      const aData = aRes.ok ? await aRes.json() : { assignments: {}, units: [] };
      setConfigured(bData.configured !== false);
      setError(bData.error ?? null);
      const list: Battle[] = bData.battles ?? [];
      setBattles(list);
      setAssignments(aData.assignments ?? {});
      setUnits(aData.units ?? []);

      const pinMap: Record<string, number> = {};
      for (const p of (pData.pins ?? []) as Pin[]) pinMap[p.battleId] = p.weight;
      setPins(pinMap);

      if (list.length) {
        const nRes = await fetch(
          `/api/notes?battleIds=${encodeURIComponent(list.map((b) => b.id).join(","))}`
        );
        if (nRes.ok) {
          const nData = await nRes.json();
          setNotes(nData.notes ?? {});
        }
      }
    } catch {
      setError("Greska u dohvatu.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    timer.current = setInterval(load, 45_000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [load]);

  const visible = useMemo(() => {
    const query = q.trim().toLowerCase();
    const list = battles.filter((b) => {
      if (!query) return true;
      const hay = [b.label, b.attacker.name, b.defender.name, b.regionName, ...(notes[b.id] ?? []).map((n) => n.body)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(query);
    });
    // Prioritetne (P1 > P2 > P3 > P4) prvo, zatim po steti
    return [...list].sort((a, b) => {
      const pa = pins[a.id] ?? 99;
      const pb = pins[b.id] ?? 99;
      if (pa !== pb) return pa - pb;
      return (b.totalDamage ?? 0) - (a.totalDamage ?? 0);
    });
  }, [battles, notes, pins, q]);

  async function setPin(battle: Battle, prio: number | null) {
    if (!canCommand) return;
    if (prio === null) {
      await fetch(`/api/pins?battleId=${encodeURIComponent(battle.id)}`, { method: "DELETE" });
      setPins((prev) => {
        const next = { ...prev };
        delete next[battle.id];
        return next;
      });
    } else {
      await fetch("/api/pins", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ battleId: battle.id, battleLabel: battle.label, weight: prio })
      });
      setPins((prev) => ({ ...prev, [battle.id]: prio }));
    }
  }

  async function assign(battleId: string, muId: string) {
    const unit = units.find((u) => u.muId === muId);
    if (!unit) return;
    const muName = unit.label ?? "Jedinica";
    setAssignments((prev) => {
      const cur = prev[battleId] ?? [];
      if (cur.some((a) => a.muId === muId)) return prev;
      return { ...prev, [battleId]: [...cur, { muId, muName }] };
    });
    await fetch("/api/assignments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ battleId, muId, muName })
    }).catch(() => {});
  }

  async function unassign(battleId: string, muId: string) {
    setAssignments((prev) => ({
      ...prev,
      [battleId]: (prev[battleId] ?? []).filter((a) => a.muId !== muId)
    }));
    await fetch(
      `/api/assignments?battleId=${encodeURIComponent(battleId)}&muId=${encodeURIComponent(muId)}`,
      { method: "DELETE" }
    ).catch(() => {});
  }

  return (
    <div>
      <div className="section-head">
        <h1>Nadzorna ploca</h1>
        <div className="head-actions">
          <Help text="Klik na bitku otvara detaljan prikaz: steta, bounty, ugovori, dodijeljene jedinice i biljeske. Zvjezdica postavlja prioritet P1-P4." />
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
          placeholder="Pretrazi bitku, drzavu, regiju..."
        />
      </div>

      {!configured && (
        <div className="notice">War Era API nije spojen. Biljeske i pinovi i dalje rade.</div>
      )}
      {error && <div className="notice err">{error}</div>}
      {loading && <div className="empty">Ucitavanje...</div>}

      {!loading && visible.length === 0 && <div className="empty">Nema aktivnih bitaka</div>}

      <div className="battle-list">
        {visible.map((b) => (
          <BattleCard
            key={b.id}
            battle={b}
            notes={notes[b.id] ?? []}
            pinPrio={pins[b.id] ?? null}
            assigned={assignments[b.id] ?? []}
            units={units}
            canCommand={canCommand}
            open={openId === b.id}
            onToggle={() => setOpenId(openId === b.id ? null : b.id)}
            onSetPin={(prio) => setPin(b, prio)}
            onAssign={(muId) => assign(b.id, muId)}
            onUnassign={(muId) => unassign(b.id, muId)}
            onNotesChange={(next) => setNotes((prev) => ({ ...prev, [b.id]: next }))}
          />
        ))}
      </div>
    </div>
  );
}

function PinMenu({
  prio,
  onSet
}: {
  prio: number | null;
  onSet: (p: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="dd pin-dd" ref={ref} onClick={(e) => e.stopPropagation()}>
      <button
        className={`pin-btn ${prio ? "on" : ""}`}
        style={prio ? { color: PIN_COLOR[prio] } : undefined}
        onClick={() => setOpen((v) => !v)}
        title={prio ? `Prioritet P${prio}` : "Oznaci prioritet bitke"}
      >
        {prio ? "★" : "☆"}
      </button>
      {open && (
        <div className="dd-menu pin-menu">
          <div className="dd-title">Prioritet bitke</div>
          {[1, 2, 3, 4].map((p) => (
            <button
              key={p}
              className={`dd-item ${prio === p ? "sel" : ""}`}
              style={{ color: PIN_COLOR[p] }}
              onClick={() => {
                onSet(p);
                setOpen(false);
              }}
            >
              <span>★ Prio {p}</span>
              <span className="dd-hint">
                {p === 1 ? "hitno" : p === 2 ? "visoko" : p === 3 ? "srednje" : "nisko"}
              </span>
            </button>
          ))}
          {prio && (
            <button
              className="dd-item dd-danger"
              onClick={() => {
                onSet(null);
                setOpen(false);
              }}
            >
              Makni prioritet
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Contracts({ battle }: { battle: Battle }) {
  const att = battle.attacker.contracts ?? [];
  const def = battle.defender.contracts ?? [];
  if (!att.length && !def.length) return null;
  return (
    <div className="contracts">
      <span className="contracts-lbl">Ugovori</span>
      {[...att.map((c) => ({ c, s: "N" })), ...def.map((c) => ({ c, s: "B" }))].map(({ c, s }) => (
        <a
          key={`${s}-${c.id}`}
          href={c.link}
          target="_blank"
          rel="noreferrer"
          className="contract-mu"
          title={`${c.name} (${s === "N" ? "napadac" : "branitelj"})`}
        >
          {c.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.avatarUrl} alt={c.name} />
          ) : (
            <span className="contract-fallback">{c.name.slice(0, 2).toUpperCase()}</span>
          )}
          <span className="contract-name">{c.name}</span>
        </a>
      ))}
    </div>
  );
}

function BountyChips({ battle }: { battle: Battle }) {
  const chips: { key: string; text: string; title: string }[] = [];
  for (const [side, lbl] of [
    [battle.attacker, "napadac"],
    [battle.defender, "branitelj"]
  ] as const) {
    if (side.bountyPer1k || side.bountyPool) {
      const parts: string[] = [];
      if (side.bountyPer1k) parts.push(`$${money(side.bountyPer1k)}/1k`);
      if (side.bountyPool) parts.push(`fond $${money(side.bountyPool)}`);
      chips.push({
        key: lbl,
        text: parts.join(" · "),
        title: `Bounty za stranu: ${side.name ?? lbl}`
      });
    }
  }
  if (!chips.length) return null;
  return (
    <>
      {chips.map((c) => (
        <span key={c.key} className="meta-chip bounty" title={c.title}>
          {c.text}
        </span>
      ))}
    </>
  );
}

function AssignMenu({
  units,
  assigned,
  onAssign
}: {
  units: TrackedUnit[];
  assigned: Assignment[];
  onAssign: (muId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const available = units.filter((u) => !assigned.some((a) => a.muId === u.muId));

  return (
    <div className="dd" ref={ref}>
      <button type="button" className="btn btn-sm" onClick={() => setOpen((v) => !v)}>
        + Dodijeli jedinicu
      </button>
      {open && (
        <div className="dd-menu">
          <div className="dd-title">Posalji u ovu bitku</div>
          {available.length === 0 ? (
            <div className="dd-empty">Sve jedinice su dodijeljene</div>
          ) : (
            available.map((u) => (
              <button
                key={u.muId}
                className="dd-item"
                onClick={() => {
                  onAssign(u.muId);
                  setOpen(false);
                }}
              >
                ⚑ {u.label ?? u.muId.slice(-6)}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function BattleCard({
  battle,
  notes,
  pinPrio,
  assigned,
  units,
  canCommand,
  open,
  onToggle,
  onSetPin,
  onAssign,
  onUnassign,
  onNotesChange
}: {
  battle: Battle;
  notes: Note[];
  pinPrio: number | null;
  assigned: Assignment[];
  units: TrackedUnit[];
  canCommand: boolean;
  open: boolean;
  onToggle: () => void;
  onSetPin: (p: number | null) => void;
  onAssign: (muId: string) => void;
  onUnassign: (muId: string) => void;
  onNotesChange: (n: Note[]) => void;
}) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState("HITNO");
  const [saving, setSaving] = useState(false);

  const att = battle.attacker.damage ?? 0;
  const def = battle.defender.damage ?? 0;
  const total = att + def;
  const attPct = total > 0 ? (att / total) * 100 : 50;

  const hasBounty = Boolean(
    battle.attacker.bountyPer1k ||
      battle.attacker.bountyPool ||
      battle.defender.bountyPer1k ||
      battle.defender.bountyPool
  );
  const contractCount =
    (battle.attacker.contracts?.length ?? 0) + (battle.defender.contracts?.length ?? 0);

  const topNotePrio = notes.reduce((acc, n) => {
    const o = ["NISKO", "NORMALNO", "VISOKO", "HITNO"];
    return o.indexOf(n.priority) > o.indexOf(acc) ? n.priority : acc;
  }, "");
  const border = pinPrio
    ? PIN_COLOR[pinPrio]
    : topNotePrio
      ? PRIO_COLOR[topNotePrio]
      : "var(--line-strong)";

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
        onNotesChange([data.note, ...notes]);
        setBody("");
        setNoteOpen(false);
      }
    } finally {
      setSaving(false);
    }
  }

  async function del(id: string) {
    const res = await fetch(`/api/notes?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.ok) onNotesChange(notes.filter((n) => n.id !== id));
  }

  return (
    <article
      className={`battle ${pinPrio ? "battle-pinned" : ""} ${open ? "open" : ""}`}
      style={{ borderLeftColor: border }}
    >
      {/* Kompaktni red — klik otvara detalje */}
      <div className="battle-row" onClick={onToggle} role="button" aria-expanded={open}>
        {canCommand ? (
          <PinMenu prio={pinPrio} onSet={onSetPin} />
        ) : (
          pinPrio && (
            <span
              className="pin-btn on"
              style={{ color: PIN_COLOR[pinPrio] }}
              title={`Prioritet P${pinPrio}`}
            >
              ★
            </span>
          )
        )}
        {pinPrio && (
          <span
            className="pin-badge"
            style={{ color: PIN_COLOR[pinPrio], borderColor: PIN_COLOR[pinPrio] }}
          >
            P{pinPrio}
          </span>
        )}

        <span className="battle-title">
          <Flag side={battle.attacker} />
          <span className="side-name">{battle.attacker.name ?? "—"}</span>
          <span className="vs-plain">vs</span>
          <span className="side-name">{battle.defender.name ?? "—"}</span>
          <Flag side={battle.defender} />
        </span>

        <span className="row-tags">
          {assigned.length > 0 && (
            <span className="tag-ind units" title={assigned.map((a) => a.muName).join(", ")}>
              ⚑ {assigned.length}
            </span>
          )}
          {notes.length > 0 && (
            <span className="tag-ind" title={`${notes.length} biljeski`}>
              ✎ {notes.length}
            </span>
          )}
          {hasBounty && (
            <span className="tag-ind bounty" title="Aktivan bounty">
              $
            </span>
          )}
          {contractCount > 0 && (
            <span className="tag-ind" title={`${contractCount} ugovora jedinica`}>
              ⛨ {contractCount}
            </span>
          )}
          <span className={`chevron ${open ? "up" : ""}`}>▾</span>
        </span>
      </div>

      {open && (
        <div className="battle-detail reveal">
          <div className="damage-wrap thin">
            <div className="damage-bar">
              <div className="att" style={{ width: `${attPct}%` }} />
              <div className="def" style={{ width: `${100 - attPct}%` }} />
            </div>
          </div>

          <div className="detail-meta">
            {battle.regionName && (
              <Ext href={battle.regionLink} className="meta-chip" stop>
                {battle.regionName}
              </Ext>
            )}
            {battle.round !== undefined && (
              <span className="meta-chip quiet">
                R{battle.round}
                {battle.roundsToWin ? `/${battle.roundsToWin}` : ""}
              </span>
            )}
            <BountyChips battle={battle} />
            <Ext href={battle.link} className="open-battle" title="Otvori bitku u War Era" stop>
              Otvori u War Era
            </Ext>
          </div>

          <Contracts battle={battle} />

          {(assigned.length > 0 || canCommand) && (
            <div className="assign-row">
              <span className="contracts-lbl">Dodijeljene jedinice</span>
              {assigned.map((a) => (
                <span key={a.muId} className="assign-chip">
                  ⚑ {a.muName}
                  {canCommand && (
                    <button
                      className="assign-x"
                      onClick={() => onUnassign(a.muId)}
                      title="Makni jedinicu"
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}
              {canCommand && (
                <AssignMenu units={units} assigned={assigned} onAssign={onAssign} />
              )}
              {canCommand && (
                <Help text="Oznaci koje jedinice idu u ovu bitku. Vojnici na ploci vide oznaku ⚑ uz bitku." />
              )}
            </div>
          )}

          {notes.length > 0 && (
            <div className="notes">
              {notes.map((n) => (
                <div className="note" key={n.id}>
                  <span className="bar" style={{ background: PRIO_COLOR[n.priority] }} />
                  <div className="body">
                    <span className="prio-chip" style={{ color: PRIO_COLOR[n.priority] }}>
                      {n.priority}
                    </span>{" "}
                    {n.body}
                    <div className="who">
                      {n.author} · {timeAgo(n.createdAt)}
                      {canCommand && (
                        <button className="linkish" onClick={() => del(n.id)}>
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
            (noteOpen ? (
              <form onSubmit={submit} className="note-form">
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Kratka uputa za ovu bitku..."
                  autoFocus
                  maxLength={500}
                />
                <div className="note-form-row">
                  <Dropdown
                    value={priority}
                    onChange={setPriority}
                    options={[
                      { value: "HITNO", label: "HITNO", color: PRIO_COLOR.HITNO },
                      { value: "VISOKO", label: "VISOKO", color: PRIO_COLOR.VISOKO },
                      { value: "NORMALNO", label: "NORMALNO", color: PRIO_COLOR.NORMALNO }
                    ]}
                  />
                  <button className="btn btn-primary btn-sm" disabled={saving}>
                    Objavi
                  </button>
                  <button type="button" className="btn btn-sm" onClick={() => setNoteOpen(false)}>
                    Odustani
                  </button>
                </div>
              </form>
            ) : (
              <button className="add-note" onClick={() => setNoteOpen(true)}>
                <span className="plus">+</span> Biljeska
              </button>
            ))}
        </div>
      )}
    </article>
  );
}
