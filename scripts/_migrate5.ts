import { createClient } from "@libsql/client";

async function main() {
  const c = createClient({
    url: process.env.DATABASE_URL!,
    authToken: process.env.DATABASE_AUTH_TOKEN
  });
  const stmts = [
    `ALTER TABLE plans ADD COLUMN expect TEXT`,
    `ALTER TABLE plans ADD COLUMN attack_times TEXT`,
    `UPDATE plans SET type='trenutni' WHERE type IN ('zapovijed','plan') AND type='zapovijed'`,
    `UPDATE plans SET type='trenutni' WHERE type='zapovijed'`,
    `UPDATE plans SET type='buduci' WHERE type='plan' OR type='program'`,
    `UPDATE player_status SET health='debuff' WHERE health='ozlijeden'`
  ];
  for (const sql of stmts) {
    try {
      await c.execute(sql);
      console.log("OK", sql.slice(0, 70));
    } catch (e: any) {
      const m = String(e?.message ?? e);
      if (m.includes("duplicate column")) console.log("SKIP", sql.slice(0, 40));
      else console.log("WARN", m.slice(0, 120), sql.slice(0, 40));
    }
  }
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});