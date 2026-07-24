// Zapovjedni lanac: admin > visoki zapovjednik > zapovjednik > vojnik
export const RANK_LABEL: Record<string, string> = {
  admin: "Administrator",
  visoki: "Visoki zapovjednik",
  zapovjednik: "Zapovjednik",
  vojnik: "Vojnik"
};

export const RANK_SHORT: Record<string, string> = {
  admin: "ADM",
  visoki: "VZP",
  zapovjednik: "ZAP",
  vojnik: "VOJ"
};

export function isCommandRank(rank?: string | null): boolean {
  return rank === "admin" || rank === "visoki" || rank === "zapovjednik";
}
