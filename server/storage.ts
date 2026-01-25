import { db } from "./db";
import {
  type Lead, type InsertLead, leads,
  type Challenge, type InsertChallenge, challenges,
  type Issue, type InsertIssue, issues,
  type User, type InsertUser, users
} from "@shared/schema";
import { eq, desc, sql } from "drizzle-orm";

export interface IStorage {
  // Leads
  getLeads(): Promise<Lead[]>;
  getLeadById(id: string): Promise<Lead | undefined>;
  getLeadsByIds(ids: string[]): Promise<Lead[]>;
  createLead(lead: InsertLead): Promise<Lead>;
  updateLead(id: string, updates: Partial<Lead>): Promise<Lead>;
  deleteLead(id: string): Promise<void>;
  deleteAllLeads(): Promise<number>;

  // Challenges
  getChallenges(): Promise<Challenge[]>;
  getChallengeById(id: string): Promise<Challenge | undefined>;
  createChallenge(challenge: InsertChallenge): Promise<Challenge>;
  clearRecentChallenges(): Promise<void>;

  // Issues
  getIssues(): Promise<Issue[]>;
  getIssueById(id: string): Promise<Issue | undefined>;
  getLatestIssue(): Promise<Issue | undefined>;
  createIssue(issue: InsertIssue): Promise<Issue>;
  updateIssue(id: string, updates: Partial<Issue>): Promise<Issue>;

  // Users
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserById(id: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getUserCount(): Promise<number>;
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

  async updateLead(id: string, updates: Partial<Lead>): Promise<Lead> {
    const [updatedLead] = await db
      .update(leads)
      .set(updates)
      .where(eq(leads.id, id))
      .returning();
    return updatedLead;
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
    // Only return challenges that are NOT assigned to any issue
    // This ensures the shuffle feature shows only available (unused) challenges
    // Limit to 5 to match the number of challenges generated each time
    const result = await db.execute(sql`
      SELECT
        c.id,
        c.title,
        c.description,
        c.type,
        c.created_at as "createdAt"
      FROM challenges c
      WHERE c.id NOT IN (
        SELECT DISTINCT challenge_id FROM issues WHERE challenge_id IS NOT NULL
      )
      ORDER BY c.created_at DESC
      LIMIT 5
    `);
    console.log(`[Storage] Returning ${result.rows.length} unassigned challenges`);
    return result.rows as Challenge[];
  }

  async createChallenge(challenge: InsertChallenge): Promise<Challenge> {
    const [newChallenge] = await db.insert(challenges).values(challenge).returning();
    return newChallenge;
  }

  async getChallengeById(id: string): Promise<Challenge | undefined> {
    const [challenge] = await db.select().from(challenges).where(eq(challenges.id, id)).limit(1);
    return challenge;
  }

  async clearRecentChallenges(): Promise<number> {
    // Only delete challenges that are NOT assigned to any issue (referenced in issues table)
    // We use raw SQL to ensure the NOT EXISTS clause works correctly across different SQL dialects supported by Drizzle
    const result = await db.execute(sql`
      DELETE FROM challenges
      WHERE id NOT IN (
        SELECT DISTINCT challenge_id FROM issues WHERE challenge_id IS NOT NULL
      )
    `);
    const deletedCount = result.rowCount ?? 0;
    console.log(`[Storage] Deleted ${deletedCount} unassigned challenges`);
    return deletedCount;
  }

  // Issues
  async getIssues(): Promise<Issue[]> {
    return db.select().from(issues).orderBy(desc(issues.publishedAt));
  }

  async getIssueById(id: string): Promise<Issue | undefined> {
    const [issue] = await db.select().from(issues).where(eq(issues.id, id)).limit(1);
    return issue;
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

  // Users
  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return user;
  }

  async getUserById(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  async getUserCount(): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` }).from(users);
    return Number(result[0]?.count ?? 0);
  }
}

export const storage = new DatabaseStorage();
