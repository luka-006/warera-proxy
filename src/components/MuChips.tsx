"use client";

export interface PlanMu {
  muId: string;
  name: string;
}

export interface MuOpt extends PlanMu {
  avatarUrl?: string;
  link?: string;
}

export function MuChip({
  mu,
  avatarUrl,
  compact
}: {
  mu: PlanMu;
  avatarUrl?: string;
  compact?: boolean;
}) {
  return (
    <span className={`mu-plan-chip ${compact ? "compact" : ""}`} title={mu.name}>
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="mu-plan-avatar" src={avatarUrl} alt="" />
      ) : (
        <span className="mu-plan-avatar fallback">{mu.name.slice(0, 2).toUpperCase()}</span>
      )}
      <span className="mu-plan-name">{mu.name}</span>
    </span>
  );
}

export function MuChipRow({
  mus,
  avatarMap
}: {
  mus: PlanMu[];
  avatarMap?: Map<string, string>;
}) {
  if (!mus?.length) return null;
  return (
    <div className="mu-plan-row">
      {mus.map((m) => (
        <MuChip key={m.muId} mu={m} avatarUrl={avatarMap?.get(m.muId)} />
      ))}
    </div>
  );
}

export function MuPicker({
  selected,
  options,
  onChange,
  label = "Jedinice"
}: {
  selected: PlanMu[];
  options: MuOpt[];
  onChange: (mus: PlanMu[]) => void;
  label?: string;
}) {
  function toggle(mu: MuOpt) {
    const on = selected.some((s) => s.muId === mu.muId);
    if (on) onChange(selected.filter((s) => s.muId !== mu.muId));
    else onChange([...selected, { muId: mu.muId, name: mu.name }]);
  }

  if (!options.length) {
    return <div className="muted" style={{ fontSize: 12 }}>Nema pracenih jedinica (Admin / Jedinice)</div>;
  }

  return (
    <div className="mu-picker">
      <span className="lbl">{label}</span>
      <div className="mu-picker-grid">
        {options.map((u) => {
          const on = selected.some((s) => s.muId === u.muId);
          return (
            <button
              key={u.muId}
              type="button"
              className={`mu-picker-item ${on ? "on" : ""}`}
              onClick={() => toggle(u)}
            >
              {u.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="mu-plan-avatar" src={u.avatarUrl} alt="" />
              ) : (
                <span className="mu-plan-avatar fallback">{u.name.slice(0, 2).toUpperCase()}</span>
              )}
              <span>{u.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}