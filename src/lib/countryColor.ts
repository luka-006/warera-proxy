/** Stabilna boja drzave iz ISO koda (za att/def trake) */
export function countryColor(code?: string | null, fallback = "#6f7a44"): string {
  if (!code) return fallback;
  const c = code.trim().toUpperCase();
  if (c.length < 2) return fallback;
  let h = 0;
  for (let i = 0; i < c.length; i++) h = (h * 37 + c.charCodeAt(i)) % 360;
  return `hsl(${h} 52% 40%)`;
}

export function flagUrl(code?: string | null): string | null {
  if (!code || code.length !== 2) return null;
  return `https://flagcdn.com/w40/${code.toLowerCase()}.png`;
}