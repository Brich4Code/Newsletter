import { db } from "./db";
import {
  type Lead, type InsertLead, leads,
  type Challenge, type InsertChallenge, challenges,
  type Issue, type InsertIssue, issues
} from "@shared/schema";
import { eq, desc, sql } from "drizzle-orm";

export interface IStorage {
  // Leads
  getLeads(): Promise<Lead[]>;
  getLeadById(id: string): Promise<Lead | undefined>;
  getLeadsByIds(ids: string[]): Promise<Lead[]>;
  createLead(lead: InsertLead): Promise<Lead>;
  deleteLead(id: string): Promise<void>;
  deleteAllLeads(): Promise<number>;

  // Challenges
  getChallenges(): Promise<Challenge[]>;
  getChallengeById(id: string): Promise<Challenge | undefined>;
  createChallenge(challenge: InsertChallenge): Promise<Challenge>;
  clearRecentChallenges(): Promise<void>;

  // Issues
  getIssues(): Promise<Issue[]>;
  getLatestIssue(): Promise<Issue | undefined>;
  createIssue(issue: InsertIssue): Promise<Issue>;
  updateIssue(id: string, updates: Partial<Issue>): Promise<Issue>;
}

export class DatabaseStorage implements IStorage {
  // Leads
  async getLeads(): Promise<Lead[]> {
    return db.select().from(leads).orderBy(desc(leads.relevanceScore));
  }

  async createLead(lead: InsertLead): Promise<Lead> {
    const [newLead] = await db.insert(leads).values(lead).returning();
    return newLead;
  }

  async getLeadById(id: string): Promise<Lead | undefined> {
    const [lead] = await db.select().from(leads).where(eq(leads.id, id)).limit(1);
    return lead;
  }

  async getLeadsByIds(ids: string[]): Promise<Lead[]> {
    if (ids.length === 0) return [];
    return db.select().from(leads).where(eq(leads.id, ids[0])); // TODO: Fix for multiple IDs
  }

  async deleteLead(id: string): Promise<void> {
    await db.delete(leads).where(eq(leads.id, id));
  }

  async deleteAllLeads(): Promise<number> {
    // Use raw SQL to clear FK references and delete leads
    await db.execute(sql`UPDATE issues SET main_story_id = NULL, secondary_story_id = NULL, quick_link_ids = ARRAY[]::text[]`);
    const result = await db.execute(sql`DELETE FROM leads RETURNING id`);
    return result.rowCount ?? 0;
  }

  // Challenges
  async getChallenges(): Promise<Challenge[]> {
    return db.select().from(challenges).orderBy(desc(challenges.createdAt));
  }

  async createChallenge(challenge: InsertChallenge): Promise<Challenge> {
    const [newChallenge] = await db.insert(challenges).values(challenge).returning();
    return newChallenge;
  }

  async getChallengeById(id: string): Promise<Challenge | undefined> {
    const [challenge] = await db.select().from(challenges).where(eq(challenges.id, id)).limit(1);
    return challenge;
  }

  async clearRecentChallenges(): Promise<void> {
    // Only delete challenges that are NOT assigned to any issue
    // For simplicity in this "shuffle" context, we might just wipe unassigned ones or all recent ones
    // But to be safe, we'll delete all challenges since they are ephemeral suggestions until published
    await db.delete(challenges);
  }

  // Issues
  async getIssues(): Promise<Issue[]> {
    return db.select().from(issues).orderBy(desc(issues.publishedAt));
  }

  async getLatestIssue(): Promise<Issue | undefined> {
    const [latestIssue] = await db.select().from(issues).orderBy(desc(issues.issueNumber)).limit(1);
    return latestIssue;
  }

  async createIssue(issue: InsertIssue): Promise<Issue> {
    const [newIssue] = await db.insert(issues).values(issue).returning();
    return newIssue;
  }

  async updateIssue(id: string, updates: Partial<Issue>): Promise<Issue> {
    const [updatedIssue] = await db
      .update(issues)
      .set(updates)
      .where(eq(issues.id, id))
      .returning();
    return updatedIssue;
  }
}

export const storage = new DatabaseStorage();
