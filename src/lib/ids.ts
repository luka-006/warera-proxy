import { randomBytes, randomUUID } from "crypto";

export function newId(): string {
  return randomUUID();
}

// URL-safe token za sesije
export function newToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}
