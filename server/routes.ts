import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { insertLeadSchema, insertChallengeSchema, insertIssueSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Get all leads
  app.get("/api/leads", async (req, res) => {
    try {
      const leads = await storage.getLeads();
      res.json(leads);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch leads" });
    }
  });

  // Create a new lead
  app.post("/api/leads", async (req, res) => {
    try {
      const lead = insertLeadSchema.parse(req.body);
      const newLead = await storage.createLead(lead);
      res.status(201).json(newLead);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create lead" });
      }
    }
  });

  // Get all challenges
  app.get("/api/challenges", async (req, res) => {
    try {
      const challenges = await storage.getChallenges();
      res.json(challenges);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch challenges" });
    }
  });

  // Create a new challenge
  app.post("/api/challenges", async (req, res) => {
    try {
      const challenge = insertChallengeSchema.parse(req.body);
      const newChallenge = await storage.createChallenge(challenge);
      res.status(201).json(newChallenge);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create challenge" });
      }
    }
  });

  // Get all issues
  app.get("/api/issues", async (req, res) => {
    try {
      const issues = await storage.getIssues();
      res.json(issues);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch issues" });
    }
  });

  // Publish a new issue
  app.post("/api/issues/publish", async (req, res) => {
    try {
      const issueData = insertIssueSchema.parse(req.body);
      
      // Get the next issue number
      const latestIssue = await storage.getLatestIssue();
      const issueNumber = latestIssue ? latestIssue.issueNumber + 1 : 1;
      
      // Create the issue in the database
      const newIssue = await storage.createIssue({
        ...issueData,
        issueNumber,
      });

      // TODO: Integrate with Google Docs API to create document
      // For now, we'll just return the issue
      // When Google Docs integration is set up, we'll create a document
      // and update the issue with the googleDocsUrl

      res.status(201).json(newIssue);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: "Failed to publish issue" });
      }
    }
  });

  return httpServer;
}
