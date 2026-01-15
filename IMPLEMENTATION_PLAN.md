# Hello Jumble Agentic Newsroom - Implementation Plan
**Full TypeScript + Google Stack Integration**

---

## Executive Summary

Transform the current manual editorial interface into a hybrid agentic system where:
- **Agents continuously research** and populate the database with curated leads
- **You select stories** via the existing editorial desk UI (unchanged)
- **Writer agent generates** the polished newsletter in Google Docs when you publish

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     React Frontend                           │
│              (editorial-desk.tsx - UNCHANGED)                │
│  ┌────────────┐  ┌──────────────┐  ┌─────────────┐         │
│  │ Main Story │  │ Secondary    │  │ Quick Links │         │
│  │ Selector   │  │ Story        │  │ Selector    │         │
│  └────────────┘  └──────────────┘  └─────────────┘         │
│            │                                                 │
│            └──────► "Publish Issue" Button                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Express API Server                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ GET /api/leads        → Fetch curated leads          │  │
│  │ GET /api/challenges   → Fetch weekly challenges      │  │
│  │ POST /api/issues/publish → Trigger draft generation  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
            │                                    │
            ▼                                    ▼
┌─────────────────────────┐      ┌──────────────────────────┐
│  Background Agents      │      │  Publication Pipeline     │
│  (Continuous Loop)      │      │  (On-Demand)             │
│                         │      │                          │
│  ┌──────────────────┐  │      │  ┌──────────────────┐   │
│  │ ScoopHunter      │  │      │  │ Investigator     │   │
│  │ (Gemini Flash +  │  │      │  │ (Fact-check)     │   │
│  │  Search)         │  │      │  └──────────────────┘   │
│  └──────────────────┘  │      │           ↓              │
│           ↓             │      │  ┌──────────────────┐   │
│  ┌──────────────────┐  │      │  │ Writer           │   │
│  │ Deduplicator     │  │      │  │ (Gemini Pro)     │   │
│  │ (URL + Vector)   │  │      │  └──────────────────┘   │
│  └──────────────────┘  │      │           ↓              │
│           ↓             │      │  ┌──────────────────┐   │
│  ┌──────────────────┐  │      │  │ Compliance       │   │
│  │ Store to DB      │  │      │  │ (Rule Validator) │   │
│  │ (PostgreSQL)     │  │      │  └──────────────────┘   │
│  └──────────────────┘  │      │           ↓              │
│                         │      │  ┌──────────────────┐   │
│  ┌──────────────────┐  │      │  │ Illustrator      │   │
│  │ Challenge Gen    │  │      │  │ (Imagen/Nano)    │   │
│  │ (Weekly)         │  │      │  └──────────────────┘   │
│  └──────────────────┘  │      │           ↓              │
│                         │      │  ┌──────────────────┐   │
│                         │      │  │ Google Docs API  │   │
│                         │      │  │ (Create Doc)     │   │
│                         │      │  └──────────────────┘   │
└─────────────────────────┘      └──────────────────────────┘
            │                                    │
            └────────────┬───────────────────────┘
                         ▼
              ┌────────────────────┐
              │   PostgreSQL DB    │
              │  ┌──────────────┐  │
              │  │ leads        │  │
              │  │ challenges   │  │
              │  │ issues       │  │
              │  │ history      │  │
              │  │ backlog      │  │
              │  └──────────────┘  │
              └────────────────────┘
```

---

## Phase 1: Database Schema Extensions

### 1.1 Add Vector Search Support
**File:** `shared/schema.ts`

```typescript
// New table: newsletter_history (deduplication)
export const newsletterHistory = pgTable("newsletter_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  url: text("url").notNull().unique(),
  title: text("title").notNull(),
  embedding: vector("embedding", { dimensions: 768 }), // text-embedding-004
  publishedAt: timestamp("published_at").defaultNow().notNull(),
});

// New table: newsletter_backlog (future story ideas)
export const newsletterBacklog = pgTable("newsletter_backlog", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  url: text("url").notNull(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  reason: text("reason").notNull(), // Why it was rejected but saved
  embedding: vector("embedding", { dimensions: 768 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Extend leads table to track embeddings
export const leads = pgTable("leads", {
  // ... existing fields ...
  embedding: vector("embedding", { dimensions: 768 }),
  factCheckStatus: text("fact_check_status").default("pending"), // pending, verified, failed
  primarySourceUrl: text("primary_source_url"), // Original source found by Investigator
});
```

### 1.2 Database Migration
Run: `npm run db:push`

---

## Phase 2: Google API Integration Setup

### 2.1 Install Dependencies
```bash
npm install @google/generative-ai googleapis @google-cloud/aiplatform
npm install --save-dev @types/googleapis
```

### 2.2 Environment Variables
**File:** `.env` (add these)

```env
# Google AI APIs
GOOGLE_AI_API_KEY=your_gemini_api_key
GOOGLE_CLOUD_PROJECT_ID=your_project_id

# Google Docs API (Service Account)
GOOGLE_SERVICE_ACCOUNT_EMAIL=your_service_account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_DOCS_FOLDER_ID=your_google_drive_folder_id

# Newsletter Owner
EDITOR_EMAIL=brandon@youremail.com

# Agent Configuration
RESEARCH_INTERVAL_HOURS=6
```

### 2.3 Service Account Setup Instructions
1. Go to Google Cloud Console
2. Create a new Service Account
3. Enable APIs:
   - Google Docs API
   - Google Drive API
   - Vertex AI API (for Imagen)
4. Download JSON key, extract `client_email` and `private_key`
5. Share your Google Drive folder with the service account email (Editor access)

---

## Phase 3: Core Services Layer

### 3.1 Gemini Service
**File:** `server/services/gemini.ts`

```typescript
import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";

export class GeminiService {
  private flashModel: GenerativeModel;
  private proModel: GenerativeModel;

  constructor() {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);
    this.flashModel = genAI.getGenerativeModel({
      model: "gemini-2.0-flash-exp"
    });
    this.proModel = genAI.getGenerativeModel({
      model: "gemini-1.5-pro"
    });
  }

  async generateWithFlash(prompt: string, options?: GenerationOptions): Promise<string> {
    // Use for: Research, ranking, quick decisions
  }

  async generateWithPro(prompt: string, options?: GenerationOptions): Promise<string> {
    // Use for: Writing, fact-checking, complex reasoning
  }

  async searchGrounded(query: string): Promise<SearchResult[]> {
    // Use Gemini's search grounding feature
  }

  async embed(text: string): Promise<number[]> {
    // text-embedding-004
    const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
    const result = await model.embedContent(text);
    return result.embedding.values;
  }
}
```

### 3.2 Google Docs Service
**File:** `server/services/google-docs.ts`

```typescript
import { google } from "googleapis";
import { JWT } from "google-auth-library";

export class GoogleDocsService {
  private docs;
  private drive;
  private auth: JWT;

  constructor() {
    this.auth = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      scopes: [
        "https://www.googleapis.com/auth/documents",
        "https://www.googleapis.com/auth/drive",
      ],
    });

    this.docs = google.docs({ version: "v1", auth: this.auth });
    this.drive = google.drive({ version: "v3", auth: this.auth });
  }

  async createNewsletterDocument(content: NewsletterContent): Promise<string> {
    // 1. Create blank document
    // 2. Parse Markdown content (headers, bold, links)
    // 3. Build batchUpdate requests
    // 4. Insert hero image
    // 5. Apply all formatting
    // 6. Share with editor email
    // 7. Return Google Docs URL
  }

  private parseMarkdownToBatchRequests(markdown: string): any[] {
    // Convert # Header -> Heading 1
    // Convert **bold** -> Bold text style
    // Convert [text](url) -> Hyperlink
  }
}
```

### 3.3 Vector Search Service
**File:** `server/services/vector-search.ts`

```typescript
import { db } from "../db";
import { sql } from "drizzle-orm";
import { GeminiService } from "./gemini";

export class VectorSearchService {
  private gemini: GeminiService;

  constructor() {
    this.gemini = new GeminiService();
  }

  async checkDuplicate(url: string, title: string): Promise<boolean> {
    // 1. Check exact URL match in history
    const urlMatch = await db.query.newsletterHistory.findFirst({
      where: (history, { eq }) => eq(history.url, url),
    });
    if (urlMatch) return true;

    // 2. Generate embedding for title
    const embedding = await this.gemini.embed(title);

    // 3. Semantic search with cosine similarity
    const similar = await db.execute(sql`
      SELECT url, title,
        1 - (embedding <=> ${embedding}::vector) as similarity
      FROM newsletter_history
      WHERE 1 - (embedding <=> ${embedding}::vector) > 0.85
      LIMIT 1
    `);

    return similar.length > 0;
  }

  async addToHistory(url: string, title: string): Promise<void> {
    const embedding = await this.gemini.embed(title);
    await db.insert(newsletterHistory).values({
      url,
      title,
      embedding,
    });
  }
}
```

---

## Phase 4: Agent Implementation

### 4.1 ScoopHunter Agent
**File:** `server/agents/scoophunter.ts`

```typescript
import { GeminiService } from "../services/gemini";
import { VectorSearchService } from "../services/vector-search";
import { storage } from "../storage";

export class ScoopHunterAgent {
  private gemini: GeminiService;
  private vectorSearch: VectorSearchService;

  async run(): Promise<void> {
    console.log("[ScoopHunter] Starting research cycle...");

    // 1. Search for AI news
    const searchQueries = [
      "latest AI breakthroughs announcements",
      "new AI models released",
      "AI research papers this week",
      "AI startup funding news",
    ];

    const allCandidates: Candidate[] = [];

    for (const query of searchQueries) {
      const results = await this.gemini.searchGrounded(query);

      for (const result of results) {
        // 2. Check for duplicates
        const isDuplicate = await this.vectorSearch.checkDuplicate(
          result.url,
          result.title
        );

        if (!isDuplicate) {
          allCandidates.push({
            title: result.title,
            url: result.url,
            snippet: result.snippet,
            source: this.extractSource(result.url),
          });
        }
      }
    }

    // 3. Score relevance
    const scoredCandidates = await this.scoreRelevance(allCandidates);

    // 4. Store to database
    for (const candidate of scoredCandidates) {
      if (candidate.relevanceScore >= 70) {
        const embedding = await this.gemini.embed(candidate.title);
        await storage.createLead({
          title: candidate.title,
          url: candidate.url,
          summary: candidate.summary,
          source: candidate.source,
          relevanceScore: candidate.relevanceScore,
          embedding,
        });
      }
    }

    console.log(`[ScoopHunter] Added ${scoredCandidates.length} new leads`);
  }

  private async scoreRelevance(candidates: Candidate[]): Promise<ScoredCandidate[]> {
    // Use Gemini Flash to score each candidate 0-100
    // Criteria: Newsworthiness, AI relevance, source credibility
  }
}
```

### 4.2 Challenge Generator Agent
**File:** `server/agents/challenge-generator.ts`

```typescript
export class ChallengeGeneratorAgent {
  async run(): Promise<void> {
    console.log("[ChallengeGenerator] Creating weekly challenges...");

    const prompt = `Generate 3 creative AI coding challenges for a weekly newsletter.
    Each challenge should be:
    - Beginner to intermediate difficulty
    - Solvable in 30-60 minutes
    - Related to AI/ML concepts
    - Fun and educational

    Return as JSON array with: { title, description, type }`;

    const response = await this.gemini.generateWithFlash(prompt);
    const challenges = JSON.parse(response);

    for (const challenge of challenges) {
      await storage.createChallenge(challenge);
    }
  }
}
```

### 4.3 Investigator Agent
**File:** `server/agents/investigator.ts`

```typescript
export class InvestigatorAgent {
  async verifyStory(lead: Lead): Promise<FactCheckResult> {
    console.log(`[Investigator] Fact-checking: ${lead.title}`);

    // 1. Verify URL is live
    const isLive = await this.checkUrlLive(lead.url);
    if (!isLive) {
      return { status: "failed", reason: "URL is dead" };
    }

    // 2. Find primary source
    const primarySource = await this.findPrimarySource(lead);

    // 3. Extract key facts
    const facts = await this.extractKeyFacts(lead);

    return {
      status: "verified",
      primarySourceUrl: primarySource,
      keyFacts: facts,
    };
  }

  private async findPrimarySource(lead: Lead): Promise<string | null> {
    // Use Gemini with search grounding to find original paper/blog
    const prompt = `Find the original primary source for this news:
    Title: ${lead.title}
    Current source: ${lead.url}

    Return the URL of the original research paper, blog post, or announcement.`;

    const result = await this.gemini.searchGrounded(prompt);
    return result[0]?.url || lead.url;
  }
}
```

### 4.4 Writer Agent
**File:** `server/agents/writer.ts`

```typescript
import { GeminiService } from "../services/gemini";
import { NewsletterStyleGuide } from "../config/style-guide";

export class WriterAgent {
  private gemini: GeminiService;
  private styleGuide: NewsletterStyleGuide;

  async generateNewsletter(issue: IssueData): Promise<string> {
    console.log("[Writer] Drafting newsletter...");

    const prompt = this.buildPrompt(issue);
    const draft = await this.gemini.generateWithPro(prompt);

    return draft;
  }

  private buildPrompt(issue: IssueData): string {
    return `You are the writer for the Hello Jumble AI newsletter.

STYLE GUIDE:
${this.styleGuide.rules}

CONTENT TO WRITE:
- Main Story: ${issue.mainStory.title}
  Summary: ${issue.mainStory.summary}

- Secondary Story: ${issue.secondaryStory.title}
  Summary: ${issue.secondaryStory.summary}

- Quick Links (${issue.quickLinks.length}):
  ${issue.quickLinks.map(l => `• ${l.title}`).join("\n")}

- Weekly Challenge: ${issue.challenge.title}

OUTPUT FORMAT:
Write in Markdown with the following sections:
1. # Main Story Title
   [Engaging opening paragraph]

2. ## What's Happening
   [Details about main story]

3. ## Also Worth Your Time
   [Secondary story]

4. ## Quick Hits
   - [Link 1]
   - [Link 2]
   ...

5. ## This Week's Challenge
   [Challenge description]

RULES:
- Use ** for bold, NOT colons in headers
- Embed links naturally: [key phrase](url)
- No bare URLs
- No emojis unless explicitly requested
- Keep sentences punchy and conversational
- Main story: 200-300 words
- Secondary: 100-150 words
- Quick hits: 1 sentence each

Write the newsletter now in Markdown:`;
  }
}
```

### 4.5 Compliance Officer Agent
**File:** `server/agents/compliance-officer.ts`

```typescript
export class ComplianceOfficerAgent {
  async validate(markdown: string): Promise<ValidationResult> {
    console.log("[Compliance] Checking draft...");

    const violations: string[] = [];

    // Rule 1: No colons in headers
    if (/^#{1,6}\s+.*:/.test(markdown)) {
      violations.push("Headers must not contain colons");
    }

    // Rule 2: No bare URLs
    if (/https?:\/\/[^\s\)]+(?!\))/.test(markdown)) {
      violations.push("Found bare URLs - must be wrapped in [text](url)");
    }

    // Rule 3: No emojis
    if (/[\p{Emoji}]/u.test(markdown)) {
      violations.push("Emojis are not allowed unless specified");
    }

    // Rule 4: Headers must use # syntax
    if (!markdown.includes("#")) {
      violations.push("Must use # for headers, not just bold text");
    }

    // Rule 5: Links must be natural
    if (/\[click here\]|\[read more\]/i.test(markdown)) {
      violations.push("Links must be embedded in natural phrases, not 'click here'");
    }

    return {
      valid: violations.length === 0,
      violations,
    };
  }

  async fix(markdown: string, violations: string[]): Promise<string> {
    // Use Gemini to auto-fix violations
    const prompt = `Fix these violations in the newsletter:
    ${violations.join("\n")}

    Original text:
    ${markdown}

    Return the corrected version.`;

    return await this.gemini.generateWithPro(prompt);
  }
}
```

### 4.6 Illustrator Agent
**File:** `server/agents/illustrator.ts`

```typescript
export class IllustratorAgent {
  async generateHeroImage(mainStory: Lead): Promise<string> {
    console.log("[Illustrator] Creating hero image...");

    // Generate prompt based on story
    const imagePrompt = await this.createImagePrompt(mainStory);

    // Call Imagen or Nano Banana API
    const imageUrl = await this.generateImage(imagePrompt);

    return imageUrl;
  }

  private async createImagePrompt(story: Lead): Promise<string> {
    const prompt = `Create a vivid image generation prompt for this AI news story:
    "${story.title}"

    Style: Modern, geometric, vibrant colors, tech-forward
    Return only the image prompt, 1-2 sentences.`;

    return await this.gemini.generateWithFlash(prompt);
  }
}
```

---

## Phase 5: Orchestrator

### 5.1 Background Research Loop
**File:** `server/orchestrator/research-loop.ts`

```typescript
export class ResearchOrchestrator {
  private scoopHunter: ScoopHunterAgent;
  private challengeGenerator: ChallengeGeneratorAgent;
  private intervalHours: number;

  constructor() {
    this.intervalHours = parseInt(process.env.RESEARCH_INTERVAL_HOURS || "6");
  }

  start(): void {
    console.log("[Orchestrator] Starting background research loop...");

    // Run immediately
    this.runCycle();

    // Then run every N hours
    setInterval(() => {
      this.runCycle();
    }, this.intervalHours * 60 * 60 * 1000);
  }

  private async runCycle(): Promise<void> {
    try {
      // 1. Research new leads
      await this.scoopHunter.run();

      // 2. Generate challenges (weekly)
      if (this.shouldGenerateChallenges()) {
        await this.challengeGenerator.run();
      }

      console.log("[Orchestrator] Research cycle complete");
    } catch (error) {
      console.error("[Orchestrator] Error in research cycle:", error);
    }
  }

  private shouldGenerateChallenges(): boolean {
    // Only run on Mondays
    return new Date().getDay() === 1;
  }
}
```

### 5.2 Publication Pipeline
**File:** `server/orchestrator/publication-pipeline.ts`

```typescript
export class PublicationPipeline {
  private investigator: InvestigatorAgent;
  private writer: WriterAgent;
  private compliance: ComplianceOfficerAgent;
  private illustrator: IllustratorAgent;
  private docsService: GoogleDocsService;

  async generateDraft(issue: Issue): Promise<string> {
    console.log("[Pipeline] Starting draft generation...");

    // 1. Fetch full story data
    const mainStory = await storage.getLeadById(issue.mainStoryId);
    const secondaryStory = await storage.getLeadById(issue.secondaryStoryId);
    const quickLinks = await storage.getLeadsByIds(issue.quickLinkIds);
    const challenge = await storage.getChallengeById(issue.challengeId);

    // 2. Fact-check main story
    const factCheck = await this.investigator.verifyStory(mainStory);
    if (factCheck.status === "failed") {
      throw new Error(`Fact-check failed: ${factCheck.reason}`);
    }

    // 3. Write newsletter
    let draft = await this.writer.generateNewsletter({
      mainStory,
      secondaryStory,
      quickLinks,
      challenge,
    });

    // 4. Compliance check
    let validation = await this.compliance.validate(draft);
    let attempts = 0;

    while (!validation.valid && attempts < 3) {
      console.log("[Pipeline] Fixing violations:", validation.violations);
      draft = await this.compliance.fix(draft, validation.violations);
      validation = await this.compliance.validate(draft);
      attempts++;
    }

    if (!validation.valid) {
      throw new Error("Could not fix compliance violations after 3 attempts");
    }

    // 5. Generate hero image
    const heroImageUrl = await this.illustrator.generateHeroImage(mainStory);

    // 6. Create Google Doc
    const googleDocsUrl = await this.docsService.createNewsletterDocument({
      markdown: draft,
      heroImageUrl,
      issueNumber: issue.issueNumber,
    });

    // 7. Update issue with Google Docs URL
    await storage.updateIssue(issue.id, { googleDocsUrl });

    console.log("[Pipeline] Draft created:", googleDocsUrl);
    return googleDocsUrl;
  }
}
```

---

## Phase 6: API Integration

### 6.1 Update Routes
**File:** `server/routes.ts`

```typescript
// Add new endpoint
app.post("/api/issues/publish", async (req, res) => {
  try {
    const issueData = insertIssueSchema.parse(req.body);

    // Create issue record
    const latestIssue = await storage.getLatestIssue();
    const issueNumber = latestIssue ? latestIssue.issueNumber + 1 : 1;

    const newIssue = await storage.createIssue({
      ...issueData,
      issueNumber,
    });

    // Trigger publication pipeline
    const pipeline = new PublicationPipeline();
    const googleDocsUrl = await pipeline.generateDraft(newIssue);

    res.status(201).json({
      ...newIssue,
      googleDocsUrl,
    });
  } catch (error) {
    console.error("Publication failed:", error);
    res.status(500).json({
      error: "Failed to generate draft",
      details: error.message
    });
  }
});
```

### 6.2 Start Research Loop
**File:** `server/index.ts`

```typescript
// Add after app setup
import { ResearchOrchestrator } from "./orchestrator/research-loop";

// Start background research
const researchOrchestrator = new ResearchOrchestrator();
researchOrchestrator.start();
```

---

## Phase 7: Style Guide Configuration

### 7.1 Create Style Guide File
**File:** `server/config/style-guide.ts`

```typescript
export const NewsletterStyleGuide = {
  rules: `
  [PLACEHOLDER - USER WILL PROVIDE FULL STYLE GUIDE]

  Example rules:
  - Headers: Use # for H1, ## for H2
  - Bold: Use **text** (not colons)
  - Links: Embed naturally [key phrase](url)
  - Emojis: Not allowed
  - Sections: Main Story, What's Happening, Also Worth Your Time, Quick Hits, Challenge
  - Word counts: Main 200-300, Secondary 100-150
  `,

  sections: [
    { name: "Main Story", required: true },
    { name: "What's Happening", required: true },
    { name: "Also Worth Your Time", required: true },
    { name: "Quick Hits", required: true },
    { name: "This Week's Challenge", required: true },
  ],

  wordLimits: {
    mainStory: { min: 200, max: 300 },
    secondaryStory: { min: 100, max: 150 },
    quickHit: { min: 10, max: 30 },
  },
};
```

---

## Phase 8: Testing & Validation

### 8.1 Test Checklist

```
□ Background research loop runs and populates leads
□ Leads appear in editorial desk UI
□ Can select stories and publish issue
□ Investigator verifies links are live
□ Writer generates newsletter in Markdown
□ Compliance catches all rule violations
□ Illustrator creates hero image
□ Google Docs API creates formatted document
□ Document is shared with editor email
□ Google Docs URL is saved to database
```

### 8.2 Manual Testing Flow
1. Start server: `npm run dev`
2. Wait 30 seconds for first research cycle
3. Check database: `SELECT * FROM leads;`
4. Open editorial desk: `http://localhost:5000`
5. Select stories and click "Publish Issue"
6. Check console logs for pipeline progress
7. Verify Google Docs link in response
8. Open Google Docs and verify formatting

---

## Phase 9: Deployment Configuration

### 9.1 Environment Variables (Production)
```env
NODE_ENV=production
DATABASE_URL=postgres://...
GOOGLE_AI_API_KEY=...
GOOGLE_SERVICE_ACCOUNT_EMAIL=...
GOOGLE_PRIVATE_KEY=...
GOOGLE_DOCS_FOLDER_ID=...
EDITOR_EMAIL=...
RESEARCH_INTERVAL_HOURS=6
```

### 9.2 Database Indexes
```sql
-- Add indexes for performance
CREATE INDEX idx_leads_relevance ON leads(relevance_score DESC);
CREATE INDEX idx_leads_created ON leads(created_at DESC);
CREATE INDEX idx_history_url ON newsletter_history(url);

-- Vector similarity index
CREATE INDEX idx_history_embedding ON newsletter_history
  USING ivfflat (embedding vector_cosine_ops);
```

---

## Success Criteria

✅ Background agents run automatically every 6 hours
✅ Editorial desk always has 10+ fresh leads to choose from
✅ Clicking "Publish Issue" generates a Google Doc in <60 seconds
✅ Newsletter follows all style guide rules
✅ No duplicate stories are ever suggested
✅ All links are verified as live
✅ Hero image is visually appealing and relevant
✅ Google Doc is formatted correctly (headers, bold, links)
✅ Editor can immediately open and edit the draft

---

## File Structure (Final)

```
server/
  ├── agents/
  │   ├── scoophunter.ts
  │   ├── challenge-generator.ts
  │   ├── investigator.ts
  │   ├── writer.ts
  │   ├── compliance-officer.ts
  │   └── illustrator.ts
  ├── services/
  │   ├── gemini.ts
  │   ├── google-docs.ts
  │   └── vector-search.ts
  ├── orchestrator/
  │   ├── research-loop.ts
  │   └── publication-pipeline.ts
  ├── config/
  │   └── style-guide.ts
  ├── db.ts
  ├── storage.ts
  ├── routes.ts
  └── index.ts

shared/
  └── schema.ts (extended with new tables)

client/
  └── (unchanged)
```

---

## Next Steps

1. **Provide Newsletter Style Guide** - I need your exact formatting rules
2. **Get Google API Keys** - Set up service account and APIs
3. **Implement Phase by Phase** - We'll build incrementally
4. **Test Each Agent** - Validate behavior before moving to next

Ready to start implementation when you provide the style guide!
