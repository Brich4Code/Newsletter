import { db } from "./db";
import { 
  type Lead, type InsertLead, leads,
  type Challenge, type InsertChallenge, challenges,
  type Issue, type InsertIssue, issues
} from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // Leads
  getLeads(): Promise<Lead[]>;
  createLead(lead: InsertLead): Promise<Lead>;
  
  // Challenges
  getChallenges(): Promise<Challenge[]>;
  createChallenge(challenge: InsertChallenge): Promise<Challenge>;
  
  // Issues
  getIssues(): Promise<Issue[]>;
  getLatestIssue(): Promise<Issue | undefined>;
  createIssue(issue: InsertIssue): Promise<Issue>;
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

  // Challenges
  async getChallenges(): Promise<Challenge[]> {
    return db.select().from(challenges).orderBy(desc(challenges.createdAt));
  }

  async createChallenge(challenge: InsertChallenge): Promise<Challenge> {
    const [newChallenge] = await db.insert(challenges).values(challenge).returning();
    return newChallenge;
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
}

export const storage = new DatabaseStorage();
