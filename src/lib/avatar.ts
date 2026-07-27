/** Client-safe avatar helpers (no DB imports). */

export function avatarStyle(
  callsign: string,
  hue?: number | null
): { background: string; color: string; borderColor: string } {
  const h =
    typeof hue === "number"
      ? hue
      : Math.abs([...callsign].reduce((a, c) => a + c.charCodeAt(0), 0) * 37) % 360;
  return {
    background: `hsl(${h} 28% 28%)`,
    color: `hsl(${h} 55% 78%)`,
    borderColor: `hsl(${h} 35% 42%)`
  };
}

export function initials(callsign: string): string {
  return callsign.slice(0, 2).toUpperCase();
}