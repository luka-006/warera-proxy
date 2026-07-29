import { createClient } from "@libsql/client";

async function main() {
  const c = createClient({
    url: process.env.DATABASE_URL!,
    authToken: process.env.DATABASE_AUTH_TOKEN
  });
  try {
    await c.execute(`ALTER TABLE plans ADD COLUMN mus TEXT`);
    console.log("OK mus column");
  } catch (e: any) {
    console.log("SKIP", String(e?.message ?? e).slice(0, 80));
  }
}
main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});