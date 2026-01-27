import type { Express, Request, Response, NextFunction } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { insertLeadSchema, insertChallengeSchema, insertIssueSchema } from "@shared/schema";
import { z } from "zod";
import { publicationPipeline } from "./orchestrator/publication-pipeline";
import { researchOrchestrator } from "./orchestrator/research-loop";
import { authenticateUser, createPasswordHash, hasUsers } from "./auth";

// Auth middleware to protect routes
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.session?.userId) {
    next();
  } else {
    res.status(401).json({ error: "Unauthorized" });
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // ==================== AUTH ROUTES ====================

  // Check if setup is needed (no users exist)
  app.get("/api/auth/setup-required", async (req, res) => {
    try {
      const usersExist = await hasUsers();
      res.json({ setupRequired: !usersExist });
    } catch (error) {
      console.error("[API] Setup check error:", error);
      res.status(500).json({ error: "Failed to check setup status" });
    }
  });

  // Initial setup - create admin user (only works if no users exist)
  app.post("/api/auth/setup", async (req, res) => {
    try {
      const usersExist = await hasUsers();
      if (usersExist) {
        return res.status(403).json({ error: "Setup already completed" });
      }

      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password required" });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
      }

      const passwordHash = createPasswordHash(password);
      const user = await storage.createUser({ username, passwordHash });

      // Auto-login after setup
      req.session.userId = user.id;
      req.session.username = user.username;

      res.status(201).json({
        message: "Admin user created successfully",
        user: { id: user.id, username: user.username }
      });
    } catch (error) {
      console.error("[API] Setup error:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: `Failed to create admin user: ${message}` });
    }

  });

  // Login
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password required" });
      }

      const user = await authenticateUser(username, password);
      if (!user) {
        return res.status(401).json({ error: "Invalid username or password" });
      }

      // Set session
      req.session.userId = user.id;
      req.session.username = user.username;

      res.json({
        message: "Login successful",
        user: { id: user.id, username: user.username }
      });
    } catch (error) {
      console.error("[API] Login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  // Logout
  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("[API] Logout error:", err);
        return res.status(500).json({ error: "Logout failed" });
      }
      res.clearCookie("connect.sid");
      res.json({ message: "Logged out successfully" });
    });
  });

  // Get current session
  app.get("/api/auth/session", (req, res) => {
    if (req.session?.userId) {
      res.json({
        authenticated: true,
        user: { id: req.session.userId, username: req.session.username }
      });
    } else {
      res.json({ authenticated: false });
    }
  });

  // ==================== PROTECTED API ROUTES ====================

  // Get all leads
  app.get("/api/leads", requireAuth, async (req, res) => {
    try {
      const leads = await storage.getLeads();
      res.json(leads);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch leads" });
    }
  });

  // Create a new lead
  app.post("/api/leads", requireAuth, async (req, res) => {
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
  app.patch("/api/leads/:id", requireAuth, async (req, res) => {
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
  app.delete("/api/leads", requireAuth, async (req, res) => {
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
  app.delete("/api/leads/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteLead(id);
      res.status(200).json({ success: true, message: "Lead deleted" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete lead" });
    }
  });

  // Get all challenges
  app.get("/api/challenges", requireAuth, async (req, res) => {
    try {
      const challenges = await storage.getChallenges();
      res.json(challenges);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch challenges" });
    }
  });

  // Create a new challenge (Manual addition)
  app.post("/api/challenges", requireAuth, async (req, res) => {
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
  app.post("/api/challenges/generate", requireAuth, async (req, res) => {
    try {
      console.log("[API] ========== SHUFFLE CHALLENGES START ==========");

      // 1. Clear existing unassigned challenges to keep things fresh
      console.log("[API] Step 1: Clearing unassigned challenges...");
      const deletedCount = await storage.clearRecentChallenges();
      console.log(`[API] Deleted ${deletedCount} challenges`);

      // 2. Run the generator agent
      console.log("[API] Step 2: Generating new challenges...");
      await import("./agents/challenge-generator").then(m => m.challengeGeneratorAgent.run());

      // 3. Fetch the newly created challenges
      console.log("[API] Step 3: Fetching generated challenges...");
      const newChallenges = await storage.getChallenges();
      console.log(`[API] Returning ${newChallenges.length} challenges to client`);
      console.log("[API] ========== SHUFFLE CHALLENGES END ==========");

      res.status(200).json({
        message: "Challenges generated successfully",
        challenges: newChallenges
      });
    } catch (error) {
      console.error("[API] Failed to generate challenges:", error);
      res.status(500).json({ error: "Failed to generate challenges" });
    }
  });

  // Create custom challenge from prompt
  app.post("/api/challenges/custom", requireAuth, async (req, res) => {
    try {
      console.log("[API] Creating custom challenge from prompt...");
      const { prompt } = req.body;

      if (!prompt) {
        return res.status(400).json({ error: "Missing required field: prompt" });
      }

      // Import gemini and perplexity services
      const { geminiService } = await import("./services/gemini");
      const { perplexityService } = await import("./services/perplexity");

      // First, fetch the latest AI models using Perplexity web search
      console.log("[API] Fetching latest AI models for context...");
      const modelsResearch = await perplexityService.research(
        `What are the latest AI models and tools available as of ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}? ` +
        `List the current versions for: OpenAI GPT/ChatGPT, Anthropic Claude, Google Gemini, Midjourney, DALL-E, Suno, RunwayML, and any other popular AI tools. ` +
        `Only include models that are currently publicly available.`
      );

      // Generate challenge using Gemini with user's prompt
      const generationPrompt = `Generate a creative, practical, and non-technical AI challenge based on this user request:

USER REQUEST: ${prompt}

LATEST AI MODELS (use these):
${modelsResearch.answer}

REQUIREMENTS:
- Accessible to non-experts (no coding required unless it's low-code/no-code like Zapier/Make)
- Solvable in 20-60 minutes
- Use ONLY the LATEST AI tools mentioned above
- Focus on "doing something cool" or "saving time" with cutting-edge AI
- FUN and engaging
- Should require 4-7 clear steps to complete

Create ONE challenge with:
- Catchy title (under 60 chars)
- Description (120-150 words) with 4-7 clear, simple steps
- Type: "creative", "productivity", "prompt_engineering", or "no_code"
- Use the specific model names from the LATEST AI MODELS section above

Return as JSON object:
{
  "title": "Challenge title",
  "description": "Full description with clear steps",
  "type": "challenge_type"
}`;

      const generated = await geminiService.generateJSON<{
        title: string;
        description: string;
        type: string;
      }>(generationPrompt);

      // Save to database
      const challenge = await storage.createChallenge({
        title: generated.title,
        description: generated.description,
        type: generated.type,
      });

      console.log(`[API] Custom challenge created: ${generated.title}`);
      res.status(200).json(challenge);
    } catch (error) {
      console.error("[API] Failed to create custom challenge:", error);
      res.status(500).json({ error: "Failed to create custom challenge" });
    }
  });

  // Get all issues
  app.get("/api/issues", requireAuth, async (req, res) => {
    try {
      const issues = await storage.getIssues();
      res.json(issues);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch issues" });
    }
  });

  // Trigger research cycle manually
  app.post("/api/research/start", requireAuth, async (req, res) => {
    try {
      const { mode } = req.body;
      const researchMode = mode === "deep-dive" ? "deep-dive" : "standard";

      // Trigger research in background
      researchOrchestrator.runCycle(researchMode).then(() => {
        console.log(`[API] Research cycle completed (${researchMode})`);
      }).catch((error) => {
        console.error("[API] Research cycle failed:", error);
      });

      res.status(200).json({
        status: "started",
        mode: researchMode,
        message: "Research agents are now finding stories. This will take 2-5 minutes.",
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to start research" });
    }
  });

  // Deep Dive Research Endpoint (Trend Scout)
  app.post("/api/research/deep-dive", requireAuth, async (req, res) => {
    try {
      // Trigger research in background
      researchOrchestrator.runCycle("deep-dive").then(() => {
        console.log("[API] Deep Dive research cycle completed");
      }).catch((error) => {
        console.error("[API] Deep Dive research cycle failed:", error);
      });

      res.status(200).json({
        status: "started",
        mode: "deep-dive",
        message: "Deep Dive Trend Scout started. Identifying trends and finding stories...",
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to start Deep Dive research" });
    }
  });

  // Monthly Research Endpoint (comprehensive 30-day search with expanded topics)
  app.post("/api/research/monthly", requireAuth, async (req, res) => {
    try {
      // Trigger research in background
      researchOrchestrator.runCycle("monthly").then(() => {
        console.log("[API] Monthly research cycle completed");
      }).catch((error) => {
        console.error("[API] Monthly research cycle failed:", error);
      });

      res.status(200).json({
        status: "started",
        mode: "monthly",
        message: "Monthly search started. Searching last 30 days across AI, science, and health topics...",
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to start monthly research" });
    }
  });

  // Breaking News Endpoint (last 48 hours with aggressive recency)
  app.post("/api/research/breaking", requireAuth, async (req, res) => {
    try {
      // Trigger research in background
      researchOrchestrator.runCycle("breaking").then(() => {
        console.log("[API] Breaking news research cycle completed");
      }).catch((error) => {
        console.error("[API] Breaking news research cycle failed:", error);
      });

      res.status(200).json({
        status: "started",
        mode: "breaking",
        message: "Breaking news search started. Scanning last 48 hours for trending AI stories...",
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to start breaking news research" });
    }
  });

  // Publish a new issue
  app.post("/api/issues/publish", requireAuth, async (req, res) => {
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

  // ==================== DRAFT ROUTES ====================

  // List all drafts
  app.get("/api/drafts", requireAuth, async (req, res) => {
    try {
      // Lazy import to avoid circular dependency issues if any
      const { draftService } = await import("./services/draft-service");
      const drafts = await draftService.listDrafts();
      res.json(drafts);
    } catch (error) {
      console.error("List drafts error:", error);
      res.status(500).json({ error: "Failed to fetch drafts" });
    }
  });

  // Get draft by ID
  app.get("/api/drafts/:id", requireAuth, async (req, res) => {
    try {
      const { draftService } = await import("./services/draft-service");
      const draft = await draftService.getDraft(req.params.id);
      if (!draft) return res.status(404).json({ error: "Draft not found" });
      res.json(draft);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch draft" });
    }
  });

  // Get draft by Issue Number
  app.get("/api/drafts/issue/:issueNumber", requireAuth, async (req, res) => {
    try {
      const { draftService } = await import("./services/draft-service");
      const draft = await draftService.getDraftByIssue(parseInt(req.params.issueNumber));
      if (!draft) return res.status(404).json({ error: "Draft not found" });
      res.json(draft);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch draft" });
    }
  });

  // Create new draft
  app.post("/api/drafts", requireAuth, async (req, res) => {
    try {
      const { draftService } = await import("./services/draft-service");
      const { issueNumber, content, issueId } = req.body;
      const draft = await draftService.createDraft(issueNumber, content, issueId);
      res.status(201).json(draft);
    } catch (error) {
      console.error("Create draft error:", error);
      res.status(500).json({ error: "Failed to create draft" });
    }
  });

  // Update draft (Auto-save)
  app.patch("/api/drafts/:id", requireAuth, async (req, res) => {
    try {
      const { draftService } = await import("./services/draft-service");
      const { content } = req.body;
      const draft = await draftService.updateDraft(req.params.id, content);
      res.json(draft);
    } catch (error) {
      res.status(500).json({ error: "Failed to update draft" });
    }
  });

  // Publish draft
  app.post("/api/drafts/:id/publish", requireAuth, async (req, res) => {
    try {
      const { draftService } = await import("./services/draft-service");
      const draft = await draftService.publishDraft(req.params.id);
      res.json(draft);
    } catch (error) {
      console.error("Publish error:", error);
      res.status(500).json({ error: "Failed to publish draft" });
    }
  });

  // Generate image prompt only (without creating the image)
  app.post("/api/drafts/:id/generate-prompt", requireAuth, async (req, res) => {
    try {
      const { draftService } = await import("./services/draft-service");
      const { illustratorAgent } = await import("./agents/illustrator");

      const draft = await draftService.getDraft(req.params.id);
      if (!draft) {
        return res.status(404).json({ error: "Draft not found" });
      }

      // Get the issue to find the main story
      if (!draft.issueId) {
        return res.status(400).json({ error: "Draft has no associated issue" });
      }

      const issue = await storage.getIssueById(draft.issueId);
      if (!issue) {
        return res.status(404).json({ error: "Issue not found" });
      }

      if (!issue.mainStoryId) {
        return res.status(400).json({ error: "Issue has no main story" });
      }

      // Get the actual main story Lead (just like publication pipeline does)
      const mainStory = await storage.getLeadById(issue.mainStoryId);
      if (!mainStory) {
        return res.status(404).json({ error: "Main story not found" });
      }

      // Generate prompt from the actual main story
      const prompt = await illustratorAgent.createImagePrompt(mainStory);

      console.log(`[API] Generated prompt for draft ${req.params.id} from main story "${mainStory.title}": "${prompt}"`);
      res.json({ prompt });
    } catch (error) {
      console.error("Prompt generation error:", error);
      res.status(500).json({ error: "Failed to generate prompt" });
    }
  });

  // Generate hero image for draft
  app.post("/api/drafts/:id/generate-image", requireAuth, async (req, res) => {
    try {
      const { draftService } = await import("./services/draft-service");
      const { illustratorAgent } = await import("./agents/illustrator");

      const draft = await draftService.getDraft(req.params.id);
      if (!draft) {
        return res.status(404).json({ error: "Draft not found" });
      }

      // Extract title from content (first line or H1)
      const titleMatch = draft.content.match(/^#\s+(.+)$/m) || draft.content.match(/^(.+)$/m);
      const title = titleMatch ? titleMatch[1].trim() : `Newsletter Issue #${draft.issueNumber}`;

      // Create a temporary Lead object for image generation
      const tempLead = {
        id: draft.id,
        title,
        summary: draft.content.substring(0, 500),
        source: "Newsletter",
        url: "",
        relevanceScore: 0,
        factCheckStatus: "pending",
        primarySourceUrl: null,
        note: null,
        isManual: false,
        createdAt: new Date(),
        embedding: null,
      };

      const result = await illustratorAgent.generateHeroImage(tempLead);

      if (!result) {
        return res.status(500).json({ error: "Failed to generate image" });
      }

      // Update draft with image URL and prompt
      await draftService.updateDraftImage(req.params.id, result.imageUrl, result.prompt);

      res.json({ imageUrl: result.imageUrl, prompt: result.prompt });
    } catch (error) {
      console.error("Image generation error:", error);
      res.status(500).json({ error: "Failed to generate image" });
    }
  });

  // Regenerate hero image with custom prompt
  app.post("/api/drafts/:id/regenerate-image", requireAuth, async (req, res) => {
    try {
      const { draftService } = await import("./services/draft-service");
      const { illustratorAgent } = await import("./agents/illustrator");
      const { prompt } = req.body;

      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }

      const draft = await draftService.getDraft(req.params.id);
      if (!draft) {
        return res.status(404).json({ error: "Draft not found" });
      }

      const imageUrl = await illustratorAgent.generateFromPrompt(prompt);

      // Update draft with new image URL and prompt
      await draftService.updateDraftImage(req.params.id, imageUrl, prompt);

      res.json({ imageUrl, prompt });
    } catch (error) {
      console.error("Image regeneration error:", error);
      res.status(500).json({ error: "Failed to regenerate image" });
    }
  });

  return httpServer;
}
