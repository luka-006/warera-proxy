import { createClient } from "@libsql/client";

async function main() {
  const c = createClient({
    url: process.env.DATABASE_URL!,
    authToken: process.env.DATABASE_AUTH_TOKEN
  });

  // Admin profil -> ShadowZeus (War Era username za ping test)
  const admins = await c.execute("SELECT id, callsign FROM users WHERE rank='admin'");
  for (const row of admins.rows) {
    const cs = String(row.callsign);
    if (cs.toLowerCase() !== "shadowzeus") {
      // Ako ShadowZeus vec postoji, samo oznaci
      const exists = await c.execute({
        sql: "SELECT id FROM users WHERE lower(callsign)=lower(?)",
        args: ["ShadowZeus"]
      });
      if (exists.rows.length) {
        console.log("ShadowZeus already exists:", exists.rows[0].id);
      } else {
        await c.execute({
          sql: "UPDATE users SET callsign=? WHERE id=?",
          args: ["ShadowZeus", row.id]
        });
        console.log("Renamed", cs, "-> ShadowZeus");
      }
    } else {
      console.log("Admin already ShadowZeus");
    }
  }

  await c.execute({
    sql: `INSERT INTO tracked_mus (mu_id, label, added_by, created_at)
          VALUES ('__testmu__', 'TestMU', 'system', unixepoch())
          ON CONFLICT(mu_id) DO UPDATE SET label='TestMU'`,
    args: []
  });
  console.log("TestMU tracked");
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});