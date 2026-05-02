import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { gamesTable } from "./games";

export const playersTable = pgTable("players", {
  id: serial("id").primaryKey(),
  gameId: integer("game_id")
    .notNull()
    .references(() => gamesTable.id, { onDelete: "cascade" }),
  nickname: text("nickname").notNull(),
  coins: integer("coins").notNull().default(0),
  correctAnswers: integer("correct_answers").notNull().default(0),
  totalAnswers: integer("total_answers").notNull().default(0),
  consecutiveCorrect: integer("consecutive_correct").notNull().default(0),
  isKicked: boolean("is_kicked").notNull().default(false),
  avatarColor: text("avatar_color").notNull().default("#7C3AED"),
  avatar: text("avatar").notNull().default("🐱"),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
});

export const insertPlayerSchema = createInsertSchema(playersTable).omit({
  id: true,
  coins: true,
  correctAnswers: true,
  totalAnswers: true,
  consecutiveCorrect: true,
  isKicked: true,
  joinedAt: true,
});
export type InsertPlayer = z.infer<typeof insertPlayerSchema>;
export type Player = typeof playersTable.$inferSelect;
