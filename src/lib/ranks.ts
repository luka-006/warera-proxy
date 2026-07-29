// Lanac: admin (skriven) > general (visoki) > zapovjednik > vojnik
export const RANK_LABEL: Record<string, string> = {
  admin: "",
  visoki: "General",
  zapovjednik: "Zapovjednik",
  vojnik: "Vojnik"
};

export const RANK_SHORT: Record<string, string> = {
  admin: "",
  visoki: "GEN",
  zapovjednik: "ZAP",
  vojnik: "VOJ"
};

export function isCommandRank(rank?: string | null): boolean {
  return rank === "admin" || rank === "visoki" || rank === "zapovjednik";
}

export function isGeneral(rank?: string | null): boolean {
  return rank === "visoki" || rank === "admin";
}

/** CSS klasa za outline po rangu */
export function rankOutlineClass(rank?: string | null): string {
  if (rank === "visoki" || rank === "admin") return "rank-outline-general";
  if (rank === "zapovjednik") return "rank-outline-zap";
  return "";
}