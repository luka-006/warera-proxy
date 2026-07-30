"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Dropdown from "@/components/Dropdown";
import Help from "@/components/Help";
import { MuChipRow, MuPicker, type MuOpt, type PlanMu } from "@/components/MuChips";
import PlacePicker, { type RegionOpt } from "@/components/PlacePicker";
import { GEAR_SLOTS, gearIconUrl, gearLabel, gearMeta, RARITIES } from "@/lib/gear";
import { regionToken } from "@/lib/tags";
import { avatarStyle, initials } from "@/lib/avatar";
import { RANK_LABEL, rankOutlineClass } from "@/lib/ranks";

interface Phase {
  title: string;
  when: string;
  body: string;
  mus?: PlanMu[];
}

interface AttackTime {
  at: string;
  label: string;
}

interface Plan {
  id: string;
  title: string;
  body: string;
  type: string;
  priority: string;
  expect: string;
  attackTimes: AttackTime[];
  phases: Phase[];
  gear: string[];
  mus: PlanMu[];
  battleId: string | null;
  battleLabel: string | null;
  battleLink: string | null;
  followsPlanId: string | null;
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

type SortMode = "priority" | "date" | "recent";
type PlanViewTab = "aktivno" | "povijest";

const PRIO_COLOR: Record<string, string> = {
  HITNO: "var(--prio-hitno)",
  VISOKO: "var(--prio-visoko)",
  NORMALNO: "var(--prio-normalno)",
  NISKO: "var(--prio-nisko)"
};

const PRIO_ORDER: Record<string, number> = {
  HITNO: 0,
  VISOKO: 1,
  NORMALNO: 2,
  NISKO: 3
};

const EMOJIS = ["🫡", "❤️", "👍"];

function time(d: string | number | Date) {
  return new Date(d).toLocaleString("hr-HR", { dateStyle: "short", timeStyle: "short" });
}

function fmtAt(at: string) {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return at;
  return d.toLocaleString("hr-HR", { dateStyle: "short", timeStyle: "short" });
}

function isAttackPast(at: string) {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() < Date.now();
}

function isTrenutni(p: Plan) {
  return p.type === "trenutni" || p.type === "zapovijed";
}

function nextAttack(p: Plan): { at: string; label: string } | null {
  const sorted = [...(p.attackTimes ?? [])]
    .map((t) => ({ ...t, ts: new Date(t.at).getTime() }))
    .filter((t) => !Number.isNaN(t.ts))
    .sort((a, b) => a.ts - b.ts);
  const future = sorted.find((t) => t.ts >= Date.now());
  if (future) return { at: future.at, label: future.label };
  return sorted.length ? { at: sorted[sorted.length - 1].at, label: sorted[sorted.length - 1].label } : null;
}

function sortPlans(list: Plan[], mode: SortMode): Plan[] {
  const copy = [...list];
  if (mode === "recent") {
    return copy.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
  if (mode === "priority") {
    return copy.sort((a, b) => {
      const pa = PRIO_ORDER[a.priority] ?? 2;
      const pb = PRIO_ORDER[b.priority] ?? 2;
      if (pa !== pb) return pa - pb;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }
  // date — najblizi napad prvi
  return copy.sort((a, b) => {
    const na = nextAttack(a);
    const nb = nextAttack(b);
    const ta = na ? new Date(na.at).getTime() : Infinity;
    const tb = nb ? new Date(nb.at).getTime() : Infinity;
    if (ta !== tb) return ta - tb;
    return (PRIO_ORDER[a.priority] ?? 2) - (PRIO_ORDER[b.priority] ?? 2);
  });
}

function GearIcons({ gear }: { gear: string[] }) {
  if (!gear.length) return null;
  return (
    <div className="gear-row">
      <span className="contracts-lbl">Preporucena oprema</span>
      {gear.map((k) => {
        const meta = gearMeta(k);
        const rarity = RARITIES.find((r) => r.value === meta?.rarity);
        return (
          <span
            key={k}
            className="gear-chip"
            title={gearLabel(k)}
            style={rarity ? { borderColor: rarity.color } : undefined}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={gearIconUrl(k)} alt={gearLabel(k)} />
            <span className="gear-name">{gearLabel(k)}</span>
          </span>
        );
      })}
    </div>
  );
}

function RichPlanText({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  const re = /(⟦BATTLE\|[^|]+\|[^|]+\|[^\]]+⟧)|(⟦REGION\|[^|]+\|[^|]+\|[^\]]+⟧)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(<span key={`t${last}`}>{text.slice(last, m.index)}</span>);
    const full = m[0];
    if (full.startsWith("⟦BATTLE|")) {
      const bm = /⟦BATTLE\|([^|]+)\|([^|]+)\|([^\]]+)⟧/.exec(full);
      if (bm)
        parts.push(
          <a key={`x${i++}`} href={bm[3]} target="_blank" rel="noreferrer" className="battle-chip">
            ⚔ {bm[2]}
          </a>
        );
    } else {
      const rm = /⟦REGION\|([^|]+)\|([^|]+)\|([^\]]+)⟧/.exec(full);
      if (rm)
        parts.push(
          <a key={`x${i++}`} href={rm[3]} target="_blank" rel="noreferrer" className="region-chip">
            ◎ {rm[2]}
          </a>
        );
    }
    last = m.index + full.length;
  }
  if (last < text.length) parts.push(<span key={`t${last}`}>{text.slice(last)}</span>);
  return <div className="plan-body">{parts}</div>;
}

function PlanTile({
  p,
  selected,
  onSelect,
  past,
  avatarMap
}: {
  p: Plan;
  selected: boolean;
  onSelect: (id: string) => void;
  past: boolean;
  avatarMap: Map<string, string>;
}) {
  const trenutni = isTrenutni(p);
  const na = nextAttack(p);
  return (
    <button
      type="button"
      className={`plan-tile ${selected ? "selected" : ""} ${trenutni ? "current" : ""} ${past ? "past" : ""}`}
      onClick={() => onSelect(p.id)}
    >
      <div className="plan-tile-top">
        <span className="prio-dot" style={{ background: PRIO_COLOR[p.priority] }} />
        <span className="plan-tile-type">{trenutni ? "TRENUTNI" : "BUDUCI"}</span>
        <span className="plan-tile-prio">{p.priority}</span>
      </div>
      <div className="plan-tile-title">{p.title}</div>
      {na && <div className="plan-tile-when">{fmtAt(na.at)}</div>}
      {p.mus?.length > 0 && (
        <div className="plan-tile-mus">
          <MuChipRow mus={p.mus.slice(0, 4)} avatarMap={avatarMap} />
        </div>
      )}
    </button>
  );
}

function PlanChain({ plans }: { plans: Plan[] }) {
  if (plans.length < 2) return null;
  const byId = new Map(plans.map((p) => [p.id, p]));
  const ordered: Plan[] = [];
  const used = new Set<string>();
  const roots = plans.filter((p) => !p.followsPlanId || !byId.has(p.followsPlanId));
  for (const root of roots) {
    let cur: Plan | undefined = root;
    while (cur && !used.has(cur.id)) {
      ordered.push(cur);
      used.add(cur.id);
      cur = plans.find((p) => p.followsPlanId === cur!.id);
    }
  }
  for (const p of plans) {
    if (!used.has(p.id)) ordered.push(p);
  }
  if (ordered.length < 2) return null;
  return (
    <div className="plan-chain">
      <div className="lbl">Lanac planova</div>
      <div className="plan-chain-track">
        {ordered.map((p, i) => (
          <div key={p.id} className="plan-chain-item">
            <a href={`#plan-${p.id}`} className={`plan-chain-node ${isTrenutni(p) ? "current" : ""}`}>
              <span className="prio-dot sm" style={{ background: PRIO_COLOR[p.priority] }} />
              {p.title}
            </a>
            {i < ordered.length - 1 && <span className="plan-chain-arrow">→</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function PlanOverview({
  current,
  future,
  sort,
  onSort,
  pastBattle
}: {
  current: Plan | null;
  future: Plan[];
  sort: SortMode;
  onSort: (s: SortMode) => void;
  pastBattle: (p: Plan) => boolean;
}) {
  return (
    <div className="plan-overview panel panel-pad">
      <div className="plan-overview-head">
        <div>
          <div className="plan-overview-title">Pregled planova</div>
          <div className="plan-overview-meta">
            {current ? "1 aktivan" : "Nema trenutnog"} · {future.length} buducih
          </div>
        </div>
        <div className="plan-sort">
          <span className="lbl">Sortiraj</span>
          <div className="plan-sort-btns">
            {(
              [
                ["priority", "Prioritet"],
                ["date", "Datum"],
                ["recent", "Najnovije"]
              ] as const
            ).map(([k, lbl]) => (
              <button
                key={k}
                type="button"
                className={`btn btn-sm ${sort === k ? "btn-primary" : ""}`}
                onClick={() => onSort(k)}
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>
      </div>

      {current && (
        <a href={`#plan-${current.id}`} className="plan-hero reveal">
          <div className="plan-hero-tag">TRENUTNI PLAN</div>
          <div className="plan-hero-main">
            <span className="prio-dot" style={{ background: PRIO_COLOR[current.priority] }} />
            <div>
              <div className="plan-hero-title">{current.title}</div>
              <div className="plan-hero-sub">
                {current.priority}
                {nextAttack(current) && (
                  <> · Sljedeci: {fmtAt(nextAttack(current)!.at)}</>
                )}
                {current.mus?.length > 0 && <> · {current.mus.length} MU</>}
              </div>
            </div>
          </div>
        </a>
      )}

      {future.length > 0 && (
        <div className="plan-index">
          <div className="lbl">Buduci — redoslijed</div>
          <div className="plan-index-list">
            {future.map((p, idx) => {
              const na = nextAttack(p);
              const past = pastBattle(p);
              return (
                <a
                  key={p.id}
                  href={`#plan-${p.id}`}
                  className={`plan-index-row ${past ? "past" : ""}`}
                >
                  <span className="plan-index-num">{idx + 1}</span>
                  <span className="prio-dot sm" style={{ background: PRIO_COLOR[p.priority] }} />
                  <span className="plan-index-title">{p.title}</span>
                  <span className="plan-index-prio">{p.priority}</span>
                  {na && <span className="plan-index-when">{fmtAt(na.at)}</span>}
                  {p.mus?.length > 0 && (
                    <span className="plan-index-mus">⚑ {p.mus.length}</span>
                  )}
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function PlanCard({
  p,
  plans,
  canWrite,
  pastBattle,
  avatarMap,
  onDel,
  onReact
}: {
  p: Plan;
  plans: Plan[];
  canWrite: boolean;
  pastBattle: boolean;
  avatarMap: Map<string, string>;
  onDel: (id: string) => void;
  onReact: (plan: Plan, emoji: string) => void;
}) {
  const prev = p.followsPlanId ? plans.find((x) => x.id === p.followsPlanId) : null;
  const next = plans.filter((x) => x.followsPlanId === p.id);
  const trenutni = isTrenutni(p);
  const na = nextAttack(p);

  return (
    <article
      id={`plan-${p.id}`}
      className={`plan-card ${trenutni ? "is-cmd" : "is-future"} ${pastBattle ? "past-battle" : ""} ${rankOutlineClass(p.authorRank)}`}
      style={{ borderLeftColor: pastBattle ? "var(--ink-faint)" : PRIO_COLOR[p.priority] ?? "var(--line-strong)" }}
    >
      <div className="plan-head">
        <span className="prio-chip" style={{ color: pastBattle ? "var(--ink-faint)" : PRIO_COLOR[p.priority] }}>
          {p.priority}
        </span>
        <span className={`type-chip ${trenutni ? "cmd" : "future"}`}>
          {trenutni ? "Trenutni plan" : "Buduci plan"}
        </span>
        {na && (
          <span className={`plan-when-badge ${isAttackPast(na.at) ? "past" : ""}`}>
            {na.label ? `${na.label}: ` : ""}
            {fmtAt(na.at)}
          </span>
        )}
        <h2>{p.title}</h2>
      </div>

      {p.mus?.length > 0 && (
        <div className="plan-mu-block">
          <span className="contracts-lbl">Jedinice u planu</span>
          <MuChipRow mus={p.mus} avatarMap={avatarMap} />
        </div>
      )}

      {(prev || next.length > 0 || p.battleLink) && (
        <div className="plan-links">
          {prev && (
            <a className="chain-chip" href={`#plan-${prev.id}`}>
              nastavak na: {prev.title}
            </a>
          )}
          {next.map((n) => (
            <a key={n.id} className="chain-chip next" href={`#plan-${n.id}`}>
              slijedi → {n.title}
            </a>
          ))}
          {p.battleLink && (
            <a
              href={p.battleLink}
              target="_blank"
              rel="noreferrer"
              className={`plan-battle ${pastBattle ? "past" : ""}`}
            >
              ⚔ {p.battleLabel ?? "Otvori bitku"} <span className="arrow">↗</span>
              {pastBattle && <span className="past-tag">prosla</span>}
            </a>
          )}
        </div>
      )}

      <RichPlanText text={p.body} />

      {p.expect && (
        <div className="plan-expect">
          <div className="lbl">Sto ocekujemo</div>
          <div className="plan-expect-body">{p.expect}</div>
        </div>
      )}

      {p.attackTimes?.length > 0 && (
        <div className="attack-times">
          <div className="lbl">Vremena / datumi napada</div>
          <div className="attack-time-list">
            {[...p.attackTimes]
              .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
              .map((t, i) => (
                <span key={i} className={`attack-chip ${isAttackPast(t.at) ? "past" : ""}`}>
                  {t.label ? `${t.label}: ` : ""}
                  {fmtAt(t.at)}
                </span>
              ))}
          </div>
        </div>
      )}

      <GearIcons gear={p.gear} />

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
                {ph.mus && ph.mus.length > 0 && (
                  <MuChipRow mus={ph.mus} avatarMap={avatarMap} />
                )}
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
                onClick={() => onReact(p, e)}
                title={mine ? "Makni reakciju" : "Reagiraj"}
              >
                {e}
                {count > 0 && <span className="react-count">{count}</span>}
              </button>
            );
          })}
        </div>
        <span className="plan-meta">
          <span className="avatar-circle sm" style={avatarStyle(p.author)}>
            {initials(p.author)}
          </span>
          <span className={rankOutlineClass(p.authorRank)}>
            {p.author}
            {RANK_LABEL[p.authorRank] ? ` · ${RANK_LABEL[p.authorRank]}` : ""}
          </span>
          {" · "}
          {time(p.createdAt)}
          {canWrite && (
            <button className="linkish" onClick={() => onDel(p.id)}>
              Obrisi
            </button>
          )}
        </span>
      </div>
    </article>
  );
}

export default function PlansClient({ canWrite }: { canWrite: boolean }) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [battles, setBattles] = useState<BattleOpt[]>([]);
  const [muOptions, setMuOptions] = useState<MuOpt[]>([]);
  const [activeBattleIds, setActiveBattleIds] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<SortMode>("priority");
  const [viewTab, setViewTab] = useState<PlanViewTab>("aktivno");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [expect, setExpect] = useState("");
  const [type, setType] = useState("trenutni");
  const [priority, setPriority] = useState("NORMALNO");
  const [battleId, setBattleId] = useState("");
  const [followsPlanId, setFollowsPlanId] = useState("");
  const [gear, setGear] = useState<string[]>([]);
  const [planMus, setPlanMus] = useState<PlanMu[]>([]);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [attackTimes, setAttackTimes] = useState<AttackTime[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const avatarMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const u of muOptions) {
      if (u.avatarUrl) m.set(u.muId, u.avatarUrl);
    }
    return m;
  }, [muOptions]);

  const load = useCallback(async () => {
    const res = await fetch("/api/plans");
    if (res.ok) {
      const data = await res.json();
      setPlans(
        (data.plans ?? []).map((p: Plan) => ({
          ...p,
          mus: p.mus ?? [],
          phases: (p.phases ?? []).map((ph: Phase) => ({ ...ph, mus: ph.mus ?? [] }))
        }))
      );
    }
  }, []);

  const loadMus = useCallback(async () => {
    const r = await fetch("/api/warera/units");
    if (!r.ok) return;
    const d = await r.json();
    setMuOptions(
      (d.units ?? []).map((u: { id: string; name: string; avatarUrl?: string; link?: string }) => ({
        muId: u.id,
        name: u.name,
        avatarUrl: u.avatarUrl,
        link: u.link
      }))
    );
  }, []);

  useEffect(() => {
    load();
    loadMus();
    fetch("/api/warera/battles")
      .then((r) => r.json())
      .then((d) => {
        const list = (d.battles ?? []) as { id: string }[];
        setActiveBattleIds(new Set(list.map((b) => b.id)));
      })
      .catch(() => {});
  }, [load, loadMus]);

  useEffect(() => {
    if (!open || battles.length) return;
    fetch("/api/warera/battles")
      .then((r) => r.json())
      .then((d) => {
        const list = (d.battles ?? []).map((b: { id: string; label: string; regionName?: string }) => ({
          id: b.id,
          label: b.label,
          regionName: b.regionName
        }));
        setBattles(list);
        setActiveBattleIds(new Set(list.map((b: BattleOpt) => b.id)));
      })
      .catch(() => {});
  }, [open, battles.length]);

  function updatePhase(i: number, patch: Partial<Phase>) {
    setPhases((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }

  function updateAttack(i: number, patch: Partial<AttackTime>) {
    setAttackTimes((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }

  function setSlotGear(slot: string, key: string) {
    setGear((prev) => {
      const without = prev.filter((k) => gearMeta(k)?.slot !== slot);
      return key ? [...without, key] : without;
    });
  }

  function slotValue(slot: string) {
    return gear.find((k) => gearMeta(k)?.slot === slot) ?? "";
  }

  function insertPlace(r: RegionOpt) {
    const token = regionToken(r.id, r.name, r.link);
    setBody((t) => `${t}${t && !t.endsWith(" ") && t.length ? " " : ""}${token}`);
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
          expect,
          type,
          priority,
          battleId: battleId || undefined,
          battleLabel: battle?.label,
          followsPlanId: followsPlanId || undefined,
          gear,
          mus: planMus,
          phases: phases.filter((p) => p.title.trim() || p.body.trim()),
          attackTimes: attackTimes.filter((t) => t.at.trim())
        })
      });
      if (res.ok) {
        setTitle("");
        setBody("");
        setExpect("");
        setPhases([]);
        setAttackTimes([]);
        setBattleId("");
        setFollowsPlanId("");
        setGear([]);
        setPlanMus([]);
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
    ...battles.map((b) => ({ value: b.id, label: b.label, hint: b.regionName }))
  ];

  const followOptions = [
    { value: "", label: "Samostalan plan" },
    ...plans.map((p) => ({ value: p.id, label: p.title }))
  ];

  const trenutniRaw = plans.filter(isTrenutni);
  const buduciRaw = plans.filter((p) => !isTrenutni(p));
  const currentPlan = trenutniRaw[0] ?? null;
  const trenutniRest = trenutniRaw.slice(1);
  const buduciSorted = sortPlans([...buduciRaw, ...trenutniRest], sort);

  const pastBattle = useCallback(
    (p: Plan) => {
      if (p.battleId && !activeBattleIds.has(p.battleId)) return true;
      if (p.attackTimes?.length && p.attackTimes.every((t) => isAttackPast(t.at))) return true;
      return false;
    },
    [activeBattleIds]
  );

  const activePlans = useMemo(() => {
    const all = currentPlan
      ? [currentPlan, ...buduciSorted.filter((p) => p.id !== currentPlan.id)]
      : buduciSorted;
    return all.filter((p) => !pastBattle(p));
  }, [currentPlan, buduciSorted, pastBattle]);

  const historyPlans = useMemo(
    () =>
      plans
        .filter((p) => pastBattle(p))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [plans, pastBattle]
  );

  const selectedPlan =
    plans.find((p) => p.id === selectedId) ?? activePlans[0] ?? historyPlans[0] ?? null;

  useEffect(() => {
    if (!selectedId && activePlans[0]) setSelectedId(activePlans[0].id);
  }, [activePlans, selectedId]);

  return (
    <div>
      <div className="section-head">
        <h1>Planovi</h1>
        <div className="head-actions">
          <Help text="Aktivni planovi su pregledni grid. Prosli idu u Veliku Hrvatsku Povijest. MU tagani u planu dobiju auto-ping." />
          <div className="plan-view-tabs">
            <button
              type="button"
              className={`btn btn-sm ${viewTab === "aktivno" ? "btn-primary" : ""}`}
              onClick={() => setViewTab("aktivno")}
            >
              Aktivno ({activePlans.length})
            </button>
            <button
              type="button"
              className={`btn btn-sm ${viewTab === "povijest" ? "btn-primary" : ""}`}
              onClick={() => setViewTab("povijest")}
            >
              Velika Hrvatska Povijest ({historyPlans.length})
            </button>
          </div>
          {canWrite && (
            <button className="btn btn-primary btn-sm" onClick={() => setOpen((v) => !v)}>
              {open ? "Zatvori" : "Nova objava"}
            </button>
          )}
        </div>
      </div>

      {viewTab === "aktivno" && activePlans.length > 0 && (
        <>
          <PlanOverview
            current={currentPlan && !pastBattle(currentPlan) ? currentPlan : null}
            future={activePlans.filter((p) => !isTrenutni(p))}
            sort={sort}
            onSort={setSort}
            pastBattle={pastBattle}
          />
          <PlanChain plans={activePlans} />
          <div className="plan-tile-grid">
            {activePlans.map((p) => (
              <PlanTile
                key={p.id}
                p={p}
                selected={selectedPlan?.id === p.id}
                onSelect={setSelectedId}
                past={pastBattle(p)}
                avatarMap={avatarMap}
              />
            ))}
          </div>
        </>
      )}

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
                  { value: "trenutni", label: "Trenutni plan", hint: "aktivan briefing" },
                  { value: "buduci", label: "Buduci plan", hint: "priprema" }
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
          </div>
          <div className="form-row">
            <label className="field">
              <span className="lbl">Aktivna bitka</span>
              <Dropdown value={battleId} onChange={setBattleId} options={battleOptions} placeholder="Bez bitke" />
            </label>
            <label className="field">
              <span className="lbl">Nastavak na plan</span>
              <Dropdown value={followsPlanId} onChange={setFollowsPlanId} options={followOptions} placeholder="Samostalan" />
            </label>
          </div>

          <MuPicker selected={planMus} options={muOptions} onChange={setPlanMus} label="Jedinice u planu" />

          <label className="field">
            <span className="lbl">
              Detalji plana <PlacePicker onPick={insertPlace} buttonLabel="Ubaci mjesto" />
            </span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              maxLength={8000}
              style={{ minHeight: 140 }}
              placeholder="Sto, tko, gdje, kako..."
            />
          </label>

          <label className="field">
            <span className="lbl">Sto ocekujemo</span>
            <textarea
              value={expect}
              onChange={(e) => setExpect(e.target.value)}
              maxLength={4000}
              style={{ minHeight: 90 }}
              placeholder="Ishod, rizici..."
            />
          </label>

          <div className="phase-builder">
            <div className="phase-builder-head">
              <span className="lbl">Vremena i datumi napada</span>
              {attackTimes.length < 12 && (
                <button type="button" className="btn btn-sm" onClick={() => setAttackTimes((p) => [...p, { at: "", label: "" }])}>
                  + Dodaj vrijeme
                </button>
              )}
            </div>
            {attackTimes.map((t, i) => (
              <div key={i} className="phase-edit reveal attack-edit">
                <div className="phase-edit-top">
                  <input value={t.label} onChange={(e) => updateAttack(i, { label: e.target.value })} placeholder="Oznaka" maxLength={80} />
                  <input type="datetime-local" value={t.at} onChange={(e) => updateAttack(i, { at: e.target.value })} className="phase-when" />
                  <button type="button" className="linkish" onClick={() => setAttackTimes((p) => p.filter((_, idx) => idx !== i))}>ukloni</button>
                </div>
              </div>
            ))}
          </div>

          <div className="field">
            <span className="lbl">Preporucena oprema</span>
            <div className="gear-slots">
              {GEAR_SLOTS.map((s) => (
                <label key={s.slot} className="gear-slot">
                  <span className="lbl">{s.label}</span>
                  <Dropdown
                    value={slotValue(s.slot)}
                    onChange={(v) => setSlotGear(s.slot, v)}
                    options={[
                      { value: "", label: "— nema —" },
                      ...s.options.map((o) => ({
                        value: o.key,
                        label: o.label,
                        color: RARITIES.find((r) => r.value === o.rarity)?.color
                      }))
                    ]}
                    placeholder="—"
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="phase-builder">
            <div className="phase-builder-head">
              <span className="lbl">Faze plana</span>
              {phases.length < 12 && (
                <button type="button" className="btn btn-sm" onClick={() => setPhases((p) => [...p, { title: "", when: "", body: "", mus: [] }])}>
                  + Dodaj fazu
                </button>
              )}
            </div>
            {phases.map((ph, i) => (
              <div key={i} className="phase-edit reveal">
                <div className="phase-edit-top">
                  <span className="phase-num">FAZA {i + 1}</span>
                  <input value={ph.title} onChange={(e) => updatePhase(i, { title: e.target.value })} placeholder="Naziv faze" maxLength={80} />
                  <input value={ph.when} onChange={(e) => updatePhase(i, { when: e.target.value })} placeholder="Kada" maxLength={60} className="phase-when" />
                  <button type="button" className="linkish" onClick={() => setPhases((p) => p.filter((_, idx) => idx !== i))}>ukloni</button>
                </div>
                <MuPicker
                  selected={ph.mus ?? []}
                  options={muOptions}
                  onChange={(mus) => updatePhase(i, { mus })}
                  label="Jedinice u fazi"
                />
                <textarea value={ph.body} onChange={(e) => updatePhase(i, { body: e.target.value })} placeholder="Detalji faze..." maxLength={1500} />
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
      ) : viewTab === "aktivno" ? (
        selectedPlan && !pastBattle(selectedPlan) ? (
          <div className="plan-list">
            <div className="plan-section-lbl">Detalji — {selectedPlan.title}</div>
            <PlanCard
              p={selectedPlan}
              plans={plans}
              canWrite={canWrite}
              pastBattle={pastBattle(selectedPlan)}
              avatarMap={avatarMap}
              onDel={del}
              onReact={react}
            />
          </div>
        ) : (
          <div className="empty">Nema aktivnih planova</div>
        )
      ) : historyPlans.length > 0 ? (
        <div className="plan-history">
          <div className="plan-section-lbl">Arhiva — zavrseni planovi i bitke</div>
          <div className="plan-history-track">
            {historyPlans.map((p, i) => (
              <div key={p.id} className="plan-history-node">
                <div className="plan-history-marker">{historyPlans.length - i}</div>
                <PlanCard
                  p={p}
                  plans={plans}
                  canWrite={canWrite}
                  pastBattle
                  avatarMap={avatarMap}
                  onDel={del}
                  onReact={react}
                />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="empty">Povijest je prazna — zavrseni planovi pojavljuju se ovdje</div>
      )}
    </div>
  );
}
