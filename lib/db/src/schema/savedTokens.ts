import { sql } from "drizzle-orm";
import { integer, pgTable, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./auth";

export const savedTokensTable = pgTable(
  "saved_tokens",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    chainId: integer("chain_id").notNull(),
    tokenAddress: varchar("token_address").notNull(),
    tokenSymbol: varchar("token_symbol").notNull(),
    tokenName: varchar("token_name"),
    decimals: integer("decimals").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("UQ_saved_tokens_user_chain_addr").on(
      table.userId,
      table.chainId,
      table.tokenAddress,
    ),
  ],
);

export const insertSavedTokenSchema = createInsertSchema(savedTokensTable).omit({
  id: true,
  userId: true,
  createdAt: true,
});

export type InsertSavedToken = z.infer<typeof insertSavedTokenSchema>;
export type SavedTokenRow = typeof savedTokensTable.$inferSelect;
