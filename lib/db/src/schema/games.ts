import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { quizzesTable } from "./quizzes";

export const gameStatusEnum = pgEnum("game_status", [
  "waiting",
  "playing",
  "ended",
]);

export const gamesTable = pgTable("games", {
  id: serial("id").primaryKey(),
  quizId: integer("quiz_id")
    .notNull()
    .references(() => quizzesTable.id),
  hostId: integer("host_id")
    .notNull()
    .references(() => usersTable.id),
  code: text("code").notNull().unique(),
  status: gameStatusEnum("status").notNull().default("waiting"),
  skillLuckScale: integer("skill_luck_scale").notNull().default(3),
  minExplanationTime: integer("min_explanation_time").notNull().default(7),
  currentQuestionIndex: integer("current_question_index").notNull().default(-1),
  duration: integer("duration").notNull().default(480),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertGameSchema = createInsertSchema(gamesTable).omit({
  id: true,
  currentQuestionIndex: true,
  createdAt: true,
});
export type InsertGame = z.infer<typeof insertGameSchema>;
export type Game = typeof gamesTable.$inferSelect;
