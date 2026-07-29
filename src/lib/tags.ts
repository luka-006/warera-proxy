/** Shared battle/region token parsers for chat + plans */
export const BATTLE_TOKEN_RE = /⟦BATTLE\|([^|]+)\|([^|]+)\|([^\]]+)⟧/g;
export const REGION_TOKEN_RE = /⟦REGION\|([^|]+)\|([^|]+)\|([^\]]+)⟧/g;

export function battleToken(id: string, label: string, link: string): string {
  return `⟦BATTLE|${id}|${label}|${link}⟧`;
}

export function regionToken(id: string, name: string, link: string): string {
  return `⟦REGION|${id}|${name}|${link}⟧`;
}