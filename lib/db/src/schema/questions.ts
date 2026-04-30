import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { quizzesTable } from "./quizzes";

export const questionsTable = pgTable("questions", {
  id: serial("id").primaryKey(),
  quizId: integer("quiz_id")
    .notNull()
    .references(() => quizzesTable.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  options: jsonb("options").notNull().$type<string[]>(),
  correctAnswer: integer("correct_answer").notNull(),
  explanation: text("explanation"),
  timeLimit: integer("time_limit").notNull().default(30),
  points: integer("points").notNull().default(100),
  aiGenerated: boolean("ai_generated").notNull().default(false),
  orderIndex: integer("order_index").notNull().default(0),
});

export const insertQuestionSchema = createInsertSchema(questionsTable).omit({
  id: true,
});
export type InsertQuestion = z.infer<typeof insertQuestionSchema>;
export type Question = typeof questionsTable.$inferSelect;
