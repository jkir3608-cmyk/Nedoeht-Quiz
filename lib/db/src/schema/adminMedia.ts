import { pgTable, serial, text, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const adminMediaTypeEnum = pgEnum("admin_media_type", ["image", "video"]);

export const adminMediaTable = pgTable("admin_media", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  mediaType: adminMediaTypeEnum("media_type").notNull(),
  dataSrc: text("data_src").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type AdminMedia = typeof adminMediaTable.$inferSelect;
