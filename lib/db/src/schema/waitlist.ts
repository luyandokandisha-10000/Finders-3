import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const waitlistTable = pgTable("waitlist", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  notifiedAt: timestamp("notified_at"),
  referralCode: text("referral_code").notNull().unique(),
  referredBy: text("referred_by"),
});

export const insertWaitlistSchema = createInsertSchema(waitlistTable).omit({
  id: true,
  createdAt: true,
  notifiedAt: true,
});
export type InsertWaitlist = z.infer<typeof insertWaitlistSchema>;
export type Waitlist = typeof waitlistTable.$inferSelect;
