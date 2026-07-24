import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import * as schema from "../src/db/schema";
import { generatePhrase, normalizeCallsign } from "../src/lib/phrase";

// Ucitaj .env rucno (tsx ga ne ucitava automatski)
function loadEnv() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    /* .env nije obavezan lokalno */
  }
}

async function main() {
  loadEnv();
  const url = process.env.DATABASE_URL ?? "file:local.db";
  const authToken = process.env.DATABASE_AUTH_TOKEN;
  const client = createClient({ url, authToken });
  const db = drizzle(client, { schema });

  // Zadani kanal
  const chSlug = "zapovjednistvo";
  const existingChannel = await db
    .select({ id: schema.channels.id })
    .from(schema.channels)
    .where(eq(schema.channels.slug, chSlug))
    .limit(1);
  if (!existingChannel[0]) {
    await db.insert(schema.channels).values({
      id: randomUUID(),
      slug: chSlug,
      name: "Zapovjednistvo",
      description: "Opci kanal za sve postrojbe"
    });
    console.log("[seed] Kreiran kanal #zapovjednistvo");
  }

  // Primjer HR MU (ZDRUG) — admin moze dodati jos u Sucelju
  const zdrug = "69cc40fa8c83b81ca7c8fb41";
  const existingMu = await db
    .select({ muId: schema.trackedMus.muId })
    .from(schema.trackedMus)
    .where(eq(schema.trackedMus.muId, zdrug))
    .limit(1);
  if (!existingMu[0]) {
    await db.insert(schema.trackedMus).values({
      muId: zdrug,
      label: "ZDRUG",
      addedBy: "seed"
    });
    console.log("[seed] Dodana jedinica ZDRUG");
  }

  // Bootstrap admin
  const callsign = normalizeCallsign(process.env.BOOTSTRAP_ADMIN_CALLSIGN ?? "zapovjednik");
  const existingAdmin = await db
    .select({ id: schema.users.id, status: schema.users.status })
    .from(schema.users)
    .where(eq(schema.users.callsign, callsign))
    .limit(1);

  if (existingAdmin[0]) {
    console.log(`[seed] Admin '${callsign}' vec postoji. Preskacem.`);
  } else {
    const { phrase } = generatePhrase();
    const phraseHash = await bcrypt.hash(phrase, 10);
    await db.insert(schema.users).values({
      id: randomUUID(),
      callsign,
      phraseHash,
      rank: "admin",
      status: "aktivan"
    });
    console.log("\n==================================================");
    console.log("  BOOTSTRAP ADMIN KREIRAN");
    console.log(`  Pozivni znak: ${callsign}`);
    console.log(`  Jednokratna fraza: ${phrase}`);
    console.log("  Prijavi se ovom frazom i postavi trajnu lozinku.");
    console.log("==================================================\n");
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
