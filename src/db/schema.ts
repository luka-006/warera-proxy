import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, index } from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    callsign: text("callsign").notNull().unique(),
    passwordHash: text("password_hash"),
    phraseHash: text("phrase_hash"),
    rank: text("rank").notNull().default("vojnik"),
    status: text("status").notNull().default("ceka"),
    canChat: integer("can_chat", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    whitelistedBy: text("whitelisted_by"),
    lastLoginAt: integer("last_login_at", { mode: "timestamp" })
  },
  (t) => ({
    callsignIdx: index("users_callsign_idx").on(t.callsign),
    statusIdx: index("users_status_idx").on(t.status)
  })
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull()
  },
  (t) => ({
    userIdx: index("sessions_user_idx").on(t.userId)
  })
);

// Jedan zajednicki chat (kanal ostaje u shemi radi jednostavnosti)
export const channels = sqliteTable("channels", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`)
});

export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(),
    channelId: text("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`)
  },
  (t) => ({
    channelIdx: index("messages_channel_idx").on(t.channelId, t.createdAt)
  })
);

export const battleNotes = sqliteTable(
  "battle_notes",
  {
    id: text("id").primaryKey(),
    battleId: text("battle_id").notNull(),
    battleLabel: text("battle_label"),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    priority: text("priority").notNull().default("NORMALNO"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`)
  },
  (t) => ({
    battleIdx: index("battle_notes_battle_idx").on(t.battleId, t.createdAt)
  })
);

// Zapovjednik oznacava prioritetne bitke (prikazuju se prve)
export const battlePins = sqliteTable("battle_pins", {
  battleId: text("battle_id").primaryKey(),
  battleLabel: text("battle_label"),
  // 3 = HITNO, 2 = VISOKO, 1 = PRIORITET
  weight: integer("weight").notNull().default(2),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`)
});

// Plan / program / danasnja zapovijed
export const plans = sqliteTable(
  "plans",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    // zapovijed | plan | program
    type: text("type").notNull().default("zapovijed"),
    // HITNO | VISOKO | NORMALNO | NISKO
    priority: text("priority").notNull().default("NORMALNO"),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`)
  },
  (t) => ({
    createdIdx: index("plans_created_idx").on(t.createdAt)
  })
);

// Pracene vojne jedinice (HR MU) — admin dodaje
export const trackedMus = sqliteTable("tracked_mus", {
  muId: text("mu_id").primaryKey(),
  label: text("label"),
  addedBy: text("added_by"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`)
});

export type User = typeof users.$inferSelect;
export type Channel = typeof channels.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type BattleNote = typeof battleNotes.$inferSelect;
export type BattlePin = typeof battlePins.$inferSelect;
export type Plan = typeof plans.$inferSelect;
export type TrackedMu = typeof trackedMus.$inferSelect;
