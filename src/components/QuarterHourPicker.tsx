"use client";

import { useMemo } from "react";

const TIMES: string[] = [];
for (let h = 0; h < 24; h++) {
  for (const m of [0, 15, 30, 45]) {
    TIMES.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
}

function splitIso(value: string): { date: string; time: string } {
  if (!value) {
    const d = new Date();
    d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
    return {
      date: d.toISOString().slice(0, 10),
      time: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
    };
  }
  if (value.includes("T")) {
    const [date, rest] = value.split("T");
    const time = rest.slice(0, 5);
    const snapped = snapTime(time);
    return { date, time: snapped };
  }
  if (/^\d{2}:\d{2}$/.test(value)) {
    return { date: new Date().toISOString().slice(0, 10), time: snapTime(value) };
  }
  const d = new Date(value);
  if (!Number.isNaN(d.getTime())) {
    const mins = Math.round(d.getMinutes() / 15) * 15;
    d.setMinutes(mins, 0, 0);
    return {
      date: d.toISOString().slice(0, 10),
      time: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
    };
  }
  return { date: "", time: "12:00" };
}

function snapTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return "12:00";
  const snapped = Math.round(m / 15) * 15;
  const mins = snapped === 60 ? 0 : snapped;
  const hrs = snapped === 60 ? (h + 1) % 24 : h;
  return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function joinIso(date: string, time: string): string {
  if (!date || !time) return "";
  return `${date}T${time}`;
}

export function formatQuarterHour(value: string): string {
  if (!value) return "";
  const { date, time } = splitIso(value);
  if (!date) return value;
  const d = new Date(joinIso(date, time));
  if (Number.isNaN(d.getTime())) return `${date} ${time}`;
  return d.toLocaleString("hr-HR", { dateStyle: "short", timeStyle: "short" });
}

export function formatQuarterHourShort(value: string): string {
  if (!value) return "";
  const { time } = splitIso(value);
  const { date } = splitIso(value);
  if (date === new Date().toISOString().slice(0, 10)) return time;
  const d = new Date(joinIso(date, time));
  if (Number.isNaN(d.getTime())) return time;
  return d.toLocaleString("hr-HR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function QuarterHourPicker({
  value,
  onChange,
  className = ""
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const { date, time } = useMemo(() => splitIso(value), [value]);

  return (
    <div className={`qh-picker ${className}`}>
      <input
        type="date"
        className="qh-date"
        value={date}
        onChange={(e) => onChange(joinIso(e.target.value, time || "12:00"))}
      />
      <select
        className="qh-time"
        value={time}
        onChange={(e) => onChange(joinIso(date || new Date().toISOString().slice(0, 10), e.target.value))}
      >
        {TIMES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
    </div>
  );
}