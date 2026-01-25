import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, vector } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const leads = pgTable("leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  source: text("source").notNull(),
  url: text("url").notNull(),
  summary: text("summary").notNull(),
  relevanceScore: integer("relevance_score").notNull().default(0),
  embedding: vector("embedding", { dimensions: 768 }),
  factCheckStatus: text("fact_check_status").default("pending"),
  primarySourceUrl: text("primary_source_url"),
  note: text("note"), // Editorial note to guide LLM when writing about this story
  isManual: boolean("is_manual").default(false), // Whether this was manually added
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertLeadSchema = createInsertSchema(leads).omit({
  id: true,
  createdAt: true,
  embedding: true,
  factCheckStatus: true,
  primarySourceUrl: true,
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

// Newsletter history for deduplication
export const newsletterHistory = pgTable("newsletter_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  url: text("url").notNull().unique(),
  title: text("title").notNull(),
  embedding: vector("embedding", { dimensions: 768 }),
  publishedAt: timestamp("published_at").defaultNow().notNull(),
});

export const insertNewsletterHistorySchema = createInsertSchema(newsletterHistory).omit({
  id: true,
  publishedAt: true,
});

export type InsertNewsletterHistory = z.infer<typeof insertNewsletterHistorySchema>;
export type NewsletterHistory = typeof newsletterHistory.$inferSelect;

// Newsletter backlog for future story ideas
export const newsletterBacklog = pgTable("newsletter_backlog", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  url: text("url").notNull(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  reason: text("reason").notNull(),
  embedding: vector("embedding", { dimensions: 768 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertNewsletterBacklogSchema = createInsertSchema(newsletterBacklog).omit({
  id: true,
  createdAt: true,
});

export type InsertNewsletterBacklog = z.infer<typeof insertNewsletterBacklogSchema>;
export type NewsletterBacklog = typeof newsletterBacklog.$inferSelect;

// Users table for authentication
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;

export const newsletterDrafts = pgTable("newsletter_drafts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  issueId: varchar("issue_id").references(() => issues.id),
  issueNumber: integer("issue_number").notNull(),
  content: text("content").notNull(),
  status: text("status").notNull().default("draft"), // draft, published, archived
  googleDocsUrl: text("google_docs_url"),
  heroImageUrl: text("hero_image_url"),
  heroImagePrompt: text("hero_image_prompt"), // Editable prompt for regenerating image
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertNewsletterDraftSchema = createInsertSchema(newsletterDrafts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertNewsletterDraft = z.infer<typeof insertNewsletterDraftSchema>;
export type NewsletterDraft = typeof newsletterDrafts.$inferSelect;

export const newsletterVersions = pgTable("newsletter_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  draftId: varchar("draft_id").references(() => newsletterDrafts.id, { onDelete: 'cascade' }).notNull(),
  content: text("content").notNull(),
  versionNumber: integer("version_number").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertNewsletterVersionSchema = createInsertSchema(newsletterVersions).omit({
  id: true,
  createdAt: true,
});

export type InsertNewsletterVersion = z.infer<typeof insertNewsletterVersionSchema>;
export type NewsletterVersion = typeof newsletterVersions.$inferSelect;

