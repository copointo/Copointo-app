import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";

export const kvStoreTable = pgTable("kv_store", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type KvRow = typeof kvStoreTable.$inferSelect;
