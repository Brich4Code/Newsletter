import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { insertLeadSchema, insertChallengeSchema, insertIssueSchema } from "@shared/schema";
import { z } from "zod";
import { publicationPipeline } from "./orchestrator/publication-pipeline";
import { researchOrchestrator } from "./orchestrator/research-loop";

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

  // Update a lead (for adding notes)
  app.patch("/api/leads/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const updatedLead = await storage.updateLead(id, updates);
      res.status(200).json(updatedLead);
    } catch (error) {
      console.error("[API] Update lead error:", error);
      res.status(500).json({ error: "Failed to update lead" });
    }
  });

  // Delete all leads (must be before :id route to match correctly)
  app.delete("/api/leads", async (req, res) => {
    try {
      console.log("[API] DELETE /api/leads called");
      const count = await storage.deleteAllLeads();
      console.log(`[API] Deleted ${count} leads successfully`);
      res.status(200).json({ success: true, message: `Deleted ${count} leads`, count });
    } catch (error) {
      console.error("[API] Delete all leads error:", error);
      res.status(500).json({ error: "Failed to delete leads" });
    }
  });

  // Delete a lead
  app.delete("/api/leads/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteLead(id);
      res.status(200).json({ success: true, message: "Lead deleted" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete lead" });
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

  // Create a new challenge (Manual addition)
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

  // Generate new challenges (Shuffle/Refresh)
  app.post("/api/challenges/generate", async (req, res) => {
    try {
      console.log("[API] Generating new challenges...");

      // 1. Clear existing unassigned challenges to keep things fresh
      await storage.clearRecentChallenges();

      // 2. Run the generator agent
      // Note: This relies on the agent writing to storage internally
      // In a cleaner architecture we might have the agent return data and api writes it,
      // but following existing pattern where agent writes to storage.
      await import("./agents/challenge-generator").then(m => m.challengeGeneratorAgent.run());

      // 3. Update the Orchestrator/Research loop last run time if needed (optional)

      // 4. Fetch the newly created challenges
      const newChallenges = await storage.getChallenges();

      res.status(200).json({
        message: "Challenges generated successfully",
        challenges: newChallenges
      });
    } catch (error) {
      console.error("[API] Failed to generate challenges:", error);
      res.status(500).json({ error: "Failed to generate challenges" });
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

  // Trigger research cycle manually
  app.post("/api/research/start", async (req, res) => {
    try {
      // Trigger research in background
      researchOrchestrator.runCycle().then(() => {
        console.log("[API] Research cycle completed");
      }).catch((error) => {
        console.error("[API] Research cycle failed:", error);
      });

      res.status(200).json({
        status: "started",
        message: "Research agents are now finding stories. This will take 2-5 minutes.",
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to start research" });
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

      // Trigger publication pipeline (async - runs in background)
      publicationPipeline.execute(newIssue).then((result) => {
        if (!result.success) {
          console.error(`[API] Publication pipeline failed for issue #${newIssue.issueNumber}:`, result.error);
        } else {
          console.log(`[API] Publication pipeline completed for issue #${newIssue.issueNumber}: ${result.googleDocsUrl}`);
        }
      });

      // Return immediately with issue (Google Docs URL will be added async)
      res.status(201).json({
        ...newIssue,
        status: "processing",
        message: "Newsletter draft is being generated. Check back in 30-60 seconds.",
      });
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
