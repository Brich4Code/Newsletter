import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const leads = pgTable("leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  source: text("source").notNull(),
  url: text("url").notNull(),
  summary: text("summary").notNull(),
  relevanceScore: integer("relevance_score").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertLeadSchema = createInsertSchema(leads).omit({
  id: true,
  createdAt: true,
});

export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leads.$inferSelect;

export const challenges = pgTable("challenges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description").notNull(),
  type: text("type").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertChallengeSchema = createInsertSchema(challenges).omit({
  id: true,
  createdAt: true,
});

export type InsertChallenge = z.infer<typeof insertChallengeSchema>;
export type Challenge = typeof challenges.$inferSelect;

export const issues = pgTable("issues", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  issueNumber: integer("issue_number").notNull(),
  mainStoryId: varchar("main_story_id").references(() => leads.id),
  secondaryStoryId: varchar("secondary_story_id").references(() => leads.id),
  challengeId: varchar("challenge_id").references(() => challenges.id),
  quickLinkIds: text("quick_link_ids").array().notNull().default(sql`ARRAY[]::text[]`),
  googleDocsUrl: text("google_docs_url"),
  publishedAt: timestamp("published_at").defaultNow().notNull(),
});

export const insertIssueSchema = createInsertSchema(issues).omit({
  id: true,
  publishedAt: true,
});

export type InsertIssue = z.infer<typeof insertIssueSchema>;
export type Issue = typeof issues.$inferSelect;
