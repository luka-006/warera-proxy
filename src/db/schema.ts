import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, index } from "drizzle-orm/sqlite-core";

// Rangovi: admin | zapovjednik | vojnik
// Status racuna: ceka | aktivan | blokiran

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    callsign: text("callsign").notNull().unique(),
    // bcrypt hash trajne lozinke (null dok korisnik ne postavi)
    passwordHash: text("password_hash"),
    // bcrypt hash jednokratne fraze (null nakon iskoristenja)
    phraseHash: text("phrase_hash"),
    rank: text("rank").notNull().default("vojnik"),
    status: text("status").notNull().default("ceka"),
    // moze li vojnik pisati u chat (globalno dopustenje)
    canChat: integer("can_chat", { mode: "boolean" }).notNull().default(false),
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

// Sesije (dugozivuce, 90 dana)
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

// Kanali za chat (npr. #zapovjednistvo, po jedinicama)
export const channels = sqliteTable("channels", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  // samo zapovjednik/admin mogu pisati bez odobrenja
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`)
});

// Poruke u chatu
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

// Biljeske zapovjednika pod bitkama (+)
export const battleNotes = sqliteTable(
  "battle_notes",
  {
    id: text("id").primaryKey(),
    // ID bitke iz War Era API-ja
    battleId: text("battle_id").notNull(),
    // spremimo naziv/label radi prikaza povijesnih biljeski i kad bitka nestane iz live feeda
    battleLabel: text("battle_label"),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    // HITNO | VISOKO | NORMALNO | NISKO
    priority: text("priority").notNull().default("NORMALNO"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`)
  },
  (t) => ({
    battleIdx: index("battle_notes_battle_idx").on(t.battleId, t.createdAt)
  })
);

// Zahtjevi vojnika za pravo pisanja u chat
export const chatRequests = sqliteTable("chat_requests", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("ceka"), // ceka | odobreno | odbijeno
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  resolvedBy: text("resolved_by")
});

export type User = typeof users.$inferSelect;
export type Channel = typeof channels.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type BattleNote = typeof battleNotes.$inferSelect;
export type ChatRequest = typeof chatRequests.$inferSelect;
