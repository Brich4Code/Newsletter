# Newsletter Dual-Format System Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Support Jumble and Overclocked newsletter formats with automatic tweet/YouTube discovery, Grok integration, and image generation removal.

**Architecture:** Extend existing 3-phase writer pipeline (Perplexity research → Gemini writing → validation) with type-aware style guides, new Grok service for tweets + breaking news, Gemini YouTube search, and a newsletter type selector in the UI.

**Tech Stack:** TypeScript, Express, React, Drizzle ORM, PostgreSQL/Supabase, Google Gemini API, OpenRouter (Perplexity + Grok)

**Verification:** No test framework exists. Use `npm run check` (TypeScript compiler) to verify types after each task. Manual testing via the dev server (`npm run dev`).

---

## Chunk 1: Foundation

### Task 1: Fix Monthly Search Bug

**Files:**
- Modify: `server/orchestrator/research-loop.ts:80-84`
- Modify: `server/agents/scoophunter.ts:70-75`

- [ ] **Step 1: Add staleness timeout to research orchestrator**

In `server/orchestrator/research-loop.ts`, update `runCycle()` to force-reset `isRunning` if it's been stuck for over 30 minutes:

```typescript
// At the top of runCycle(), before the existing isRunning check:
async runCycle(mode: "standard" | "deep-dive" | "monthly" | "breaking" = "standard"): Promise<void> {
    // Safety: force-reset if stuck for over 30 minutes
    if (this.isRunning && this.progress.startedAt) {
      const startedAt = new Date(this.progress.startedAt).getTime();
      const minutesElapsed = (Date.now() - startedAt) / 1000 / 60;
      if (minutesElapsed > 30) {
        log(`[Orchestrator] ⚠️ Force-resetting isRunning flag (stuck for ${minutesElapsed.toFixed(0)}min)`, "orchestrator");
        this.isRunning = false;
      }
    }

    if (this.isRunning) {
      log("[Orchestrator] Research cycle already running, skipping", "orchestrator");
      return;
    }
    // ... rest unchanged
```

- [ ] **Step 2: Add detailed monthly mode logging to ScoopHunter**

In `server/agents/scoophunter.ts`, at the start of `run()` (line ~75), add a log showing the date filter and query count specifically for monthly mode:

```typescript
// After searchQueries is populated (around line 191), add:
log(`[ScoopHunter] Mode: ${mode}, Date filter: ${dateFilter}, Query count: ${searchQueries.length}`, "agent");
```

Also add a log after the scoring phase (around line 332) showing how many candidates passed vs failed:

```typescript
// After scoreAndSummarize returns:
const passing = scoredCandidates.filter(c => c.relevanceScore >= this.MIN_RELEVANCE_SCORE).length;
log(`[ScoopHunter] Scoring complete: ${scoredCandidates.length} scored, ${passing} pass threshold (>=${this.MIN_RELEVANCE_SCORE})`, "agent");
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd "C:/Users/brand/Desktop/Newsletter-main" && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add server/orchestrator/research-loop.ts server/agents/scoophunter.ts
git commit -m "fix: add staleness timeout for stuck research + monthly debug logging"
```

---

### Task 2: Schema Migration

**Files:**
- Modify: `shared/schema.ts:48-57` (issues table)
- Modify: `shared/schema.ts:118-130` (newsletterDrafts table)

- [ ] **Step 1: Add newsletterType to issues table**

In `shared/schema.ts`, add `newsletterType` column to the `issues` table definition (after `quickLinkIds`):

```typescript
newsletterType: text("newsletter_type").default("jumble").notNull(),
```

- [ ] **Step 2: Add newsletterType to newsletterDrafts table**

In `shared/schema.ts`, add `newsletterType` column to the `newsletter_drafts` table definition (after `status`):

```typescript
newsletterType: text("newsletter_type").default("jumble").notNull(),
```

- [ ] **Step 3: Push schema to database**

Run: `cd "C:/Users/brand/Desktop/Newsletter-main" && npm run db:push`
Expected: Schema changes applied (2 new columns added)

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd "C:/Users/brand/Desktop/Newsletter-main" && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add shared/schema.ts
git commit -m "feat: add newsletterType column to issues and newsletter_drafts tables"
```

---

### Task 3: Remove Image Generation

**Files:**
- Delete: `server/agents/illustrator.ts`
- Modify: `server/orchestrator/publication-pipeline.ts:1-6` (imports), `54-79` (Phase 3)
- Modify: `server/routes.ts:527-641` (image routes)
- Modify: `server/services/gemini.ts:362-386` (generateImage method)

- [ ] **Step 1: Remove image generation from publication pipeline**

In `server/orchestrator/publication-pipeline.ts`:
- Remove the `illustratorAgent` import (line 2)
- Remove the entire Phase 3 block (hero image generation, lines 54-79)
- Remove the hero image draft update block (lines 90-93)
- Keep the `draftService` logic and issue update logic

The pipeline should go directly from draft generation to saving the draft:

```typescript
import { writerAgent, type SimpleIssueContent, type StoryTopic } from "../agents/writer";
import { draftService } from "../services/draft-service";
import { storage } from "../storage";
import { log } from "../index";
import type { Issue } from "@shared/schema";

// ... PublicationResult interface stays ...

export class PublicationPipeline {
  async execute(issue: Issue): Promise<PublicationResult> {
    const startTime = Date.now();
    log(`[Pipeline] ━━━ Starting Publication for Issue #${issue.issueNumber} ━━━`, "pipeline");

    try {
      // Phase 1: Fetch basic story info and convert to simple topics
      log("[Pipeline] Phase 1: Preparing story topics...", "pipeline");
      const content = await this.prepareSimpleContent(issue);

      if (!content.mainStory) {
        throw new Error("Main story not found");
      }

      // Phase 2: Generate newsletter
      log("[Pipeline] Phase 2: Generating newsletter...", "pipeline");
      const draft = await writerAgent.generateNewsletter(content, issue.issueNumber);

      // Phase 3: Save Draft to Supabase
      log("[Pipeline] Phase 3: Saving draft...", "pipeline");
      const savedDraft = await draftService.createDraft(
        issue.issueNumber,
        draft,
        issue.id
      );

      log(`[Pipeline] Draft saved with ID: ${savedDraft.id}`, "pipeline");

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      log(`[Pipeline] ✓ Draft generation complete (${duration}s).`, "pipeline");

      return { success: true, googleDocsUrl: null };
    } catch (error) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      log(`[Pipeline] ✗ Publication failed (${duration}s): ${error}`, "pipeline");
      return { success: false, googleDocsUrl: null, error: String(error) };
    }
  }

  // prepareSimpleContent stays exactly the same
```

- [ ] **Step 2: Remove image routes from routes.ts**

In `server/routes.ts`, delete these three route handlers entirely:
- `POST /api/drafts/:id/generate-prompt` (lines 527-566)
- `POST /api/drafts/:id/generate-image` (lines 569-613)
- `POST /api/drafts/:id/regenerate-image` (lines 616-641)

- [ ] **Step 3: Remove generateImage from gemini.ts and fix duplicate temperature**

In `server/services/gemini.ts`:
1. Delete the `generateImage()` method (lines 362-386)
2. Fix the duplicate `temperature` property in `generateWithFlash()` — line 78 is a duplicate of line 77. Remove line 78.

**Note for subsequent tasks:** After deleting `generateImage` (~25 lines), line numbers in `gemini.ts` shift down. Task 5 (YouTube search) references "around line 283" for adding `searchYouTube` — after this deletion, the target location will be approximately line 258. Use the method name `searchGrounded` as anchor, not line numbers.

- [ ] **Step 4: Delete illustrator.ts**

Delete: `server/agents/illustrator.ts`

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd "C:/Users/brand/Desktop/Newsletter-main" && npx tsc --noEmit`
Expected: No errors (any remaining references to illustratorAgent should be caught here)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: remove image generation pipeline, illustrator agent, and image routes"
```

---

## Chunk 2: New Services

### Task 4: Create Grok Service

**Files:**
- Create: `server/services/grok.ts`

- [ ] **Step 1: Create the Grok service**

Create `server/services/grok.ts` following the same pattern as `server/services/perplexity.ts`:

```typescript
import { log } from "../index";
import type { SearchResult } from "./gemini";

export interface TweetResult {
  author: string;
  handle: string;
  text: string;
  url: string;
}

export class GrokService {
  private apiKey: string | null = null;
  private baseUrl = "https://openrouter.ai/api/v1/chat/completions";
  private model = "x-ai/grok-4.20-beta";

  private initialize(): void {
    if (this.apiKey) return;

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error("OPENROUTER_API_KEY environment variable is not set.");
    }

    this.apiKey = apiKey;
    log("[Grok] Service initialized successfully", "grok");
  }

  async searchTweets(topic: string, count: number = 2): Promise<TweetResult[]> {
    this.initialize();

    try {
      log(`[Grok] Searching X for tweets about: ${topic}`, "grok");

      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://newsletter.jumble.ai",
          "X-Title": "Newsletter Tweet Research",
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: "user",
              content: `Search X (Twitter) for ${count} recent, highly relevant posts about this topic: "${topic}"

Requirements:
- Find real, recent posts (last 7 days preferred)
- Posts should be from notable accounts, journalists, industry figures, or viral threads
- Each post must have substantial engagement or come from a verified/notable account
- Prefer posts that add opinion, reaction, or insider info (not just resharing a link)

Return as JSON array:
[
  {
    "author": "Display Name",
    "handle": "username",
    "text": "The exact tweet text (truncate to 280 chars if needed)",
    "url": "https://x.com/username/status/123456789"
  }
]

Return ONLY the JSON array, no other text. Return exactly ${count} results.`,
            },
          ],
          temperature: 0.3,
          max_tokens: 2000,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Grok API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const answer = data.choices?.[0]?.message?.content || "";

      const jsonMatch = answer.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const tweets: TweetResult[] = JSON.parse(jsonMatch[0]);
        log(`[Grok] Found ${tweets.length} tweets`, "grok");
        return tweets.slice(0, count);
      }

      log("[Grok] No tweets found in response", "grok");
      return [];
    } catch (error) {
      log(`[Grok] Tweet search error: ${error}`, "grok");
      return [];
    }
  }

  async searchBreakingNews(queries: string[]): Promise<SearchResult[]> {
    this.initialize();

    try {
      log(`[Grok] Searching X for breaking news (${queries.length} queries)`, "grok");

      const queryList = queries.slice(0, 5).join(", ");

      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://newsletter.jumble.ai",
          "X-Title": "Newsletter Breaking News Research",
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: "user",
              content: `Search X (Twitter) for breaking AI news stories trending in the last 48 hours.

Topics to search: ${queryList}

Find stories that are:
- Breaking or trending on X right now
- From credible sources or widely discussed
- About specific events, launches, or controversies (not opinion pieces)

For each story found, provide:
- The headline/title
- A source URL (prefer the original article URL shared on X, not the tweet URL)
- A 1-2 sentence summary

Return as JSON array:
[
  {
    "title": "Story headline",
    "url": "https://source-website.com/article",
    "snippet": "Brief summary"
  }
]

Return ONLY the JSON array. Maximum 10 results.`,
            },
          ],
          temperature: 0.3,
          max_tokens: 3000,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Grok API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const answer = data.choices?.[0]?.message?.content || "";

      const jsonMatch = answer.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const results: SearchResult[] = JSON.parse(jsonMatch[0]);
        log(`[Grok] Found ${results.length} breaking news items`, "grok");
        return results.filter(r => r.url && r.title);
      }

      log("[Grok] No breaking news found in response", "grok");
      return [];
    } catch (error) {
      log(`[Grok] Breaking news search error: ${error}`, "grok");
      return [];
    }
  }
}

export const grokService = new GrokService();
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd "C:/Users/brand/Desktop/Newsletter-main" && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add server/services/grok.ts
git commit -m "feat: add Grok service for X/Twitter search and breaking news via OpenRouter"
```

---

### Task 5: Add YouTube Search to Gemini Service

**Files:**
- Modify: `server/services/gemini.ts`

- [ ] **Step 1: Add YouTubeResult interface and searchYouTube method**

In `server/services/gemini.ts`, add the interface after the existing `SearchResult` interface (around line 22):

```typescript
export interface YouTubeResult {
  title: string;
  url: string;
  channel: string;
}
```

Then add the `searchYouTube` method to the `GeminiService` class (after the `searchGrounded` method, around line 283):

```typescript
  async searchYouTube(topic: string, count: number = 2): Promise<YouTubeResult[]> {
    this.initialize();

    try {
      log(`[Gemini YouTube] Searching for videos about: ${topic}`, "gemini");

      const result = await this.flashModel!.generateContent({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Find ${count} recent, relevant YouTube videos about: ${topic}

Requirements:
- Videos from the last 30 days preferred
- From reputable tech channels, news outlets, or official company channels
- Must be relevant explainers, news coverage, or commentary
- Prefer videos with substantial views

Return as JSON array:
[
  {
    "title": "Video title",
    "url": "https://youtube.com/watch?v=VIDEO_ID",
    "channel": "Channel Name"
  }
]

Return ONLY the JSON array. Exactly ${count} results.`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.3,
        },
        tools: [
          {
            googleSearch: {},
          },
        ],
      });

      const response = result.response;
      const text = response.text();

      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          const videos: YouTubeResult[] = JSON.parse(jsonMatch[0]);
          // Filter to only youtube.com URLs
          const filtered = videos.filter(v =>
            v.url && (v.url.includes("youtube.com") || v.url.includes("youtu.be"))
          );
          log(`[Gemini YouTube] Found ${filtered.length} videos`, "gemini");
          return filtered.slice(0, count);
        } catch (parseError) {
          log(`[Gemini YouTube] JSON parse error: ${parseError}`, "gemini");
        }
      }

      log("[Gemini YouTube] No videos found", "gemini");
      return [];
    } catch (error) {
      log(`[Gemini YouTube] Error: ${error}`, "gemini");
      return [];
    }
  }
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd "C:/Users/brand/Desktop/Newsletter-main" && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add server/services/gemini.ts
git commit -m "feat: add YouTube video search via Gemini grounded search"
```

---

## Chunk 3: Style Guides + Writer Agent

### Task 6: Create Overclocked Style Guide

**Files:**
- Create: `server/config/newsletter-rules-overclocked.md`

- [ ] **Step 1: Write the Overclocked style guide**

Create `server/config/newsletter-rules-overclocked.md` with the full Overclocked format rules. This must encode the exact structure observed from live newsletters:

```markdown
Overclocked Newsletter Rules
Last updated: 2026-03-14
Core Principles
Lowercase conversational headers. No Title Case except proper nouns.
Emoji goes at the END of story headlines, not the beginning.
Punchy, text-message-like tone. Short paragraphs. Direct language.
Every fact must be recent and verified. If uncertain, label as unverified or omit.
Embed links over natural anchor text only. Never show bare URLs.
Link Embedding Standard
Use natural noun phrase anchors of 3 to 9 words.
Link the first mention only and use each exact URL once across the newsletter.
No bare URLs. Strip tracking parameters (utm, ref, share). Prefer canonical URLs.
Place anchors over claims or nouns, not over punctuation.
Section Structure And Word Counts
Date Line
Format: "Mon, March 14 at 6:00 AM" (day of week, full month, day, time).
Main Story
Lowercase headline with emoji at END (ex. "Claude just became #1 in the app store 👑")
Italic teaser line immediately after (ex. "*it's ahead of ChatGPT now?*")
Two to three lowercase Q&A sub-headers (ex. "what happened?", "👀 wait, them too?", "....but, why now?")
75 to 175 words total. Punchy, conversational, like texting a friend who follows tech.
3 to 5 embedded source links.
One embedded tweet: > "tweet text" — [@handle](url)
One embedded YouTube video: 🎬 [Video Title](youtube-url)
One poll after a key claim (question + 2-3 options as a list).
(ex. '
Canada forces OpenAI to rewrite safety rules 🚨

*a mass shooting triggers a policy overhaul*

A mass shooting in Tumbler Ridge, BC on February 10 left eight people dead. The shooter had been banned from ChatGPT in June 2025 for policy violations. OpenAI's systems flagged concerning posts at the time but determined they didn't meet the threshold for contacting police.

what happened?

OpenAI is overhauling its Canadian safety protocols. Direct lines to Canadian police. Better detection of banned users creating new accounts. And the big shift, they're lowering the bar for when they contact law enforcement.

> "This is exactly why we need mandatory reporting frameworks for AI platforms" — [@techethicist](https://x.com/techethicist/status/123)

🎬 [Minister troubled by talks with OpenAI after Tumbler Ridge shooting](https://youtube.com/watch?v=abc123)

Should AI companies be required to report concerning users?
- Yes, it's overdue
- No, privacy matters more
- Depends on the situation')

Secondary Story
Same format as main story. Lowercase headline with emoji at END.
Italic teaser line. Q&A sub-headers. 75 to 175 words.
3 to 5 embedded source links.
One tweet embed. One YouTube video embed. One poll.
(ex. '
DeepMind staff protests military AI contracts 🧠

*over 100 employees signed a letter demanding ethical boundaries*

👀 wait, them too?

Yep. Over 100 DeepMind employees signed a letter demanding ethical boundaries on military work. No Gemini in mass surveillance. No autonomous weapons without human oversight. Some said they'd walk if leadership doesn't commit.

... Google isn't alone, OpenAI staffers have joined the protest

> "If we build tools of war, we become arms dealers with better PR" — [@airesearcher](https://x.com/airesearcher/status/456)

🎬 [OpenAI And Google Staffers Urge Limits On Pentagon AI Use](https://youtube.com/watch?v=def456)

Is it too late to stop AI in military use?
- Yes, the train has left the station
- No, regulation can still work
- It depends on the application')

weekly scoop 🍦
Six headlines. Each headline MUST be an embedded markdown link with the URL inside.
Format: emoji [Headline text](url)
All lowercase section header. One headline may include a YouTube video link.
(ex. '
weekly scoop 🍦
🤖 [ServiceNow introduces AI specialists that think and act](https://url.com)
🔊 [OpenAI smart speaker aims to revolutionize hardware](https://url.com)
🖼️ [Google Nano Banana 2 is faster cheaper and better](https://url.com)
🎬 [Nano Banana 2 Is Incredible](https://youtube.com/watch?v=xyz)
💼 [OpenAI recruits top researcher from Meta](https://url.com)
📉 [Analysis suggests bot activity is rising on Hacker News](https://url.com)')

weekly challenge
Start with "what's the challenge?" in lowercase.
Brief intro paragraph explaining the challenge.
3 to 5 steps with emoji prefixes. Casual tone.
150 to 250 words.
(ex. '
weekly challenge

what's the challenge?

Nano Banana 2 can do something most people don't realize. It can turn your notes, sketches, and raw data into polished visuals. This week, we're using that to build a personal brand asset from scratch.

📸 Step 1: Grab your worst note
Find the messiest handwritten note, whiteboard photo, or napkin sketch you have.

🍌 Step 2: Upload it to Gemini
Select the Create images tool and upload your photo.

🌍 Step 3: Translate it
Nano Banana 2 can translate and localize text directly inside the image.

🪄 Step 4: Make it yours
Upload a selfie alongside the infographic and prompt for a personal brand card.')

Wrap Up
One to two lines with questions inviting reader response.
End with "We'd love to hear your thoughts!"
(ex. "Should AI companies be required to report concerning users to police? And, can we stop AI in military use, or is it too late? We'd love to hear your thoughts!")
Sign-off: "Zoe from Overclocked"
Sources
Group URLs by section (Main Story, Secondary Story, Weekly Scoop).
List only URLs actually used in the newsletter.
Headers And Style
All headers lowercase except proper nouns and acronyms.
Emoji at the end of story headlines, not the beginning.
Sub-headers are conversational questions or observations.
One emoji per header or bullet line.
Research Standards
Use sources from the requested timeframe only.
Prefer primary or top tier outlets and cross verify important statistics.
Quality Assurance Checklist
Dates are within the requested window.
No bare URLs. Each link is embedded once.
Anchors are descriptive noun phrases of 3 to 9 words.
Tracking parameters removed. Canonical URLs preferred.
Headers are lowercase. Emojis at end of headlines.
Word counts are 75 to 175 per story.
Each story has one tweet, one YouTube video, and one poll.
```

- [ ] **Step 2: Commit**

```bash
git add server/config/newsletter-rules-overclocked.md
git commit -m "feat: add Overclocked newsletter style guide"
```

---

### Task 7: Update Jumble Style Guide

**Files:**
- Modify: `server/config/newsletter-rules.md`

- [ ] **Step 1: Update word counts and add media format instructions**

In `server/config/newsletter-rules.md`, make these changes:

1. Update the date at line 2: `Last updated: 2026-03-14`
2. Change main story target from "about 400 words" to "200 to 250 words" (line 78)
3. Change secondary story target from "about 350 words" to "200 to 250 words" (line 103)
4. Add tweet embedding format after "Embed reputable, recent sources" in the Main Story section:
```
One to two embedded tweets per story: > "tweet text" — [@handle](url)
One to two embedded YouTube videos per story: 🎬 [Video Title](youtube-url)
One poll per story after a key claim (question + 2-3 options as a list).
```
5. Add the same media rules to the Secondary Story section.

- [ ] **Step 2: Commit**

```bash
git add server/config/newsletter-rules.md
git commit -m "feat: update Jumble style guide with reduced word counts and media formats"
```

---

### Task 8: Update Style Guide Loader

**Files:**
- Modify: `server/config/style-guide.ts`

- [ ] **Step 1: Make style guide loading type-aware**

Replace the entire content of `server/config/style-guide.ts`:

```typescript
import fs from "fs";
import path from "path";

const rulesDir = path.resolve(process.cwd(), "server/config");

function loadRulesFile(filename: string): string {
  try {
    return fs.readFileSync(path.join(rulesDir, filename), "utf-8");
  } catch (error) {
    console.error(`Failed to read ${filename}:`, error);
    return `Error loading ${filename}.`;
  }
}

const jumbleRules = loadRulesFile("newsletter-rules.md");
const overclockedRules = loadRulesFile("newsletter-rules-overclocked.md");

export type NewsletterType = "jumble" | "overclocked";

export function getStyleGuideRules(type: NewsletterType = "jumble"): string {
  return type === "overclocked" ? overclockedRules : jumbleRules;
}

// Backward compatible export (defaults to jumble)
export const NewsletterStyleGuide = {
  rules: jumbleRules,
};

export type NewsletterSection = {
  name: string;
  required: boolean;
};

export type ValidationResult = {
  valid: boolean;
  violations: string[];
};
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd "C:/Users/brand/Desktop/Newsletter-main" && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add server/config/style-guide.ts
git commit -m "feat: type-aware style guide loader for Jumble and Overclocked"
```

---

### Task 9: Update Writer Agent

**Files:**
- Modify: `server/agents/writer.ts`

This is the largest change. The writer agent needs:
1. New signature with `newsletterType` parameter
2. Phase 1: add tweet + YouTube research
3. Phase 2: type-aware writing prompt
4. Phase 3: type-aware validation and word counts

- [ ] **Step 1: Update imports and add word limit constants**

At the top of `server/agents/writer.ts`, update imports and add constants:

```typescript
import { geminiService } from "../services/gemini";
import { perplexityService } from "../services/perplexity";
import { grokService } from "../services/grok";
import { getStyleGuideRules, type NewsletterType } from "../config/style-guide";
import { log } from "../index";

const WORD_LIMITS = {
  jumble: { min: 200, max: 250, target: 225 },
  overclocked: { min: 75, max: 175, target: 125 },
};
```

Remove the old `import { NewsletterStyleGuide }` line.

- [ ] **Step 2: Update generateNewsletter signature**

Change the method signature to accept `newsletterType`:

```typescript
async generateNewsletter(
  content: SimpleIssueContent,
  issueNumber: number,
  newsletterType: NewsletterType = "jumble"
): Promise<string> {
  log(`[Writer] Starting ${newsletterType} newsletter generation...`, "agent");
  // ... rest of method
```

Pass `newsletterType` through to all three phases:
- `this.researchStories(content, newsletterType)`
- `this.writeNewsletter(research, issueNumber, newsletterType)`
- `this.validateAndFixWordCounts(draft, newsletterType)`

- [ ] **Step 3: Update Phase 1 (researchStories) to add tweet + YouTube search**

Update the `researchStories` method signature to accept `newsletterType`:

```typescript
private async researchStories(content: SimpleIssueContent, newsletterType: NewsletterType): Promise<string> {
```

After the existing Perplexity research calls (around line 206), add tweet and YouTube search in parallel:

```typescript
    // Research tweets and YouTube videos for main and secondary stories
    const tweetCount = newsletterType === "jumble" ? 2 : 1;
    const videoCount = newsletterType === "jumble" ? 2 : 1;

    log(`[Writer] Searching for tweets and YouTube videos...`, "agent");

    const mediaPromises: Promise<void>[] = [];
    const tweetsByCategory: { [key: string]: string[] } = {};
    const videosByCategory: { [key: string]: string[] } = {};

    // Main story media
    mediaPromises.push(
      grokService.searchTweets(content.mainStory.title, tweetCount).then(tweets => {
        tweetsByCategory["Main Story"] = tweets.map(t =>
          `> "${t.text}" — [@${t.handle}](${t.url})`
        );
      }),
      geminiService.searchYouTube(content.mainStory.title, videoCount).then(videos => {
        videosByCategory["Main Story"] = videos.map(v =>
          `🎬 [${v.title}](${v.url})`
        );
      })
    );

    // Secondary story media
    if (content.secondaryStory) {
      mediaPromises.push(
        grokService.searchTweets(content.secondaryStory.title, tweetCount).then(tweets => {
          tweetsByCategory["Secondary Story"] = tweets.map(t =>
            `> "${t.text}" — [@${t.handle}](${t.url})`
          );
        }),
        geminiService.searchYouTube(content.secondaryStory.title, videoCount).then(videos => {
          videosByCategory["Secondary Story"] = videos.map(v =>
            `🎬 [${v.title}](${v.url})`
          );
        })
      );
    }

    await Promise.all(mediaPromises);

    // Add media sections to research document
    const mediaSections = `
---
# TWEET & VIDEO BANK
⚠️ Embed these tweets and videos in the corresponding stories.

**Main Story Tweets:**
${tweetsByCategory["Main Story"]?.join('\n') || '- (No tweets found)'}

**Main Story YouTube:**
${videosByCategory["Main Story"]?.join('\n') || '- (No videos found)'}

**Secondary Story Tweets:**
${tweetsByCategory["Secondary Story"]?.join('\n') || '- (No tweets found)'}

**Secondary Story YouTube:**
${videosByCategory["Secondary Story"]?.join('\n') || '- (No videos found)'}
---`;
```

Append `mediaSections` to the `fullResearch` string. Find the line (currently ~252):
```typescript
const fullResearch = researchSections.join('\n') + '\n' + urlBank;
```
Change to:
```typescript
const fullResearch = researchSections.join('\n') + '\n' + urlBank + '\n' + mediaSections;
```

- [ ] **Step 4: Update Phase 2 (writeNewsletter) for type-aware prompts**

Update the method signature:

```typescript
private async writeNewsletter(research: string, issueNumber: number, newsletterType: NewsletterType): Promise<string> {
```

Replace `NewsletterStyleGuide.rules` with:

```typescript
const rules = getStyleGuideRules(newsletterType);
```

Add format-specific variables:

```typescript
const newsletterName = newsletterType === "overclocked" ? "Overclocked" : "Hello Jumble";
const wordTarget = WORD_LIMITS[newsletterType].target;
```

**The writing prompt must be split into two variants.** Create a helper method that returns the correct prompt:

```typescript
private buildWritePrompt(research: string, issueNumber: number, type: NewsletterType): string {
  const rules = getStyleGuideRules(type);
  const limits = WORD_LIMITS[type];

  if (type === "overclocked") {
    return this.buildOverclockedPrompt(research, issueNumber, rules, limits);
  }
  return this.buildJumblePrompt(research, issueNumber, rules, limits);
}
```

**Overclocked prompt variant** — create `buildOverclockedPrompt()` method. This replaces the entire structure section. Key differences from Jumble:

```typescript
private buildOverclockedPrompt(research: string, issueNumber: number, rules: string, limits: { min: number; max: number; target: number }): string {
  return `You are the writer for Overclocked, a punchy AI newsletter. Issue #${issueNumber}.

# RESEARCH NOTES:

${research}

# STYLE GUIDE:

${rules}

# YOUR TASK:

Write the COMPLETE newsletter. Overclocked is conversational, punchy, like texting a friend.

# REQUIRED STRUCTURE (output in this order, NO section labels):

1. **Date line**: "Mon, March 14 at 6:00 AM" format (use today's date)
2. **Main Story**: lowercase headline + emoji at END (e.g., "Claude just became #1 in the app store 👑")
   - Italic teaser line: *short provocative question*
   - Body text, ~${limits.target} words
   - 2-3 lowercase Q&A sub-headers (e.g., "what happened?", "👀 wait, them too?")
   - Embed 3-5 URLs from Main Story URL bank
   - Embed 1 tweet from Main Story Tweets bank: > "tweet text" — [@handle](url)
   - Embed 1 YouTube video from Main Story YouTube bank: 🎬 [Title](url)
   - 1 poll: question + 2-3 options as bullet list
3. **Secondary Story**: same format as main, lowercase headline + emoji at END
   - Italic teaser, ~${limits.target} words, Q&A sub-headers
   - 3-5 URLs, 1 tweet, 1 YouTube, 1 poll
4. **weekly scoop 🍦** (lowercase): 6 emoji headlines, each as [text](url)
5. **weekly challenge**: "what's the challenge?" intro, 3-5 emoji steps
6. **Wrap Up**: 1-2 questions + "We'd love to hear your thoughts!"
7. **Sign-off**: "Zoe from Overclocked"
8. **Sources**: URLs grouped by section

# URL EMBEDDING RULES:
- ONLY use URLs from the VERIFIED URL BANK
- COPY URLs exactly — do NOT invent URLs
- Embed tweets exactly as provided in TWEET BANK
- Embed YouTube videos exactly as provided in VIDEO BANK

# OUTPUT FORMAT EXAMPLE:
\`\`\`
Mon, March 14 at 6:00 AM

Claude just became #1 in the app store 👑

*it's ahead of ChatGPT now?*

Body text here with [embedded link](url)...

what happened?

More text with [another link](url)...

> "Tweet text here" — [@handle](https://x.com/...)

🎬 [Video Title](https://youtube.com/watch?v=...)

Should AI companies prioritize ethics over features?
- Yes, absolutely
- No, features matter more
- It depends

secondary story headline here 🧠

*teaser line*

...same format...

weekly scoop 🍦

🤖 [Headline](url)
...6 items...

weekly challenge

what's the challenge?

Challenge text with emoji steps...

Questions here? We'd love to hear your thoughts!

Zoe from Overclocked

## Sources
**Main Story:** ...
\`\`\`

CRITICAL: Output ONLY the newsletter. No explanations. Wrap in \`\`\`markdown ... \`\`\`.`;
}
```

**Jumble prompt variant** — update the existing `writePrompt` as `buildJumblePrompt()`. Keep the current structure but change:
- Word count targets from ~400/~350 to `~${limits.target}`
- Add tweet embedding instructions: "Embed 1-2 tweets from Tweet bank: > \\"tweet text\\" — [@handle](url)"
- Add YouTube embedding instructions: "Embed 1-2 YouTube videos from YouTube bank: 🎬 [Title](url)"
- Add poll instructions: "Include 1 poll per story (question + 2-3 options as bullet list)"
- Replace "Hello Jumble" references with the newsletter name variable

Then in `writeNewsletter`, call: `const writePrompt = this.buildWritePrompt(research, issueNumber, newsletterType);`

- [ ] **Step 5: Update validation methods for type-awareness**

Update `isNewsletterComplete` to accept type:

```typescript
private isNewsletterComplete(draft: string, type: NewsletterType): { complete: boolean; missing: string[] } {
    const missing: string[] = [];

    if (type === "jumble") {
      if (!/Welcome to Jumble|Welcome to this week/i.test(draft)) {
        missing.push('Welcome section');
      }
      if (!/In this newsletter|In today.s newsletter/i.test(draft)) {
        missing.push('In this newsletter bullets');
      }
      // Jumble uses H1 markdown headers
      const h1Count = (draft.match(/^#\s+[^\n]+/gm) || []).length;
      if (h1Count < 2) {
        missing.push(`Story H1 headers (found ${h1Count}, need 2)`);
      }
    }

    if (type === "overclocked") {
      // Overclocked stories use italic teaser lines (*text*) as structural markers
      const teaserCount = (draft.match(/^\*[^*\n]+\*$/gm) || []).length;
      if (teaserCount < 2) {
        missing.push(`Story italic teasers (found ${teaserCount}, need 2 for 2 stories)`);
      }
    }

    // Both types need weekly scoop and challenge
    if (!/weekly scoop/i.test(draft)) missing.push('Weekly Scoop');
    if (!/weekly challenge|what.s the challenge/i.test(draft)) missing.push('Weekly Challenge');

    // Both need wrap up
    if (type === "jumble" && !/wrap.?up/i.test(draft)) missing.push('Wrap Up');
    if (type === "overclocked" && !/hear your thoughts|wrap.?up/i.test(draft)) missing.push('Wrap Up');

    // Both need sources
    if (!/##?\s*Sources/i.test(draft)) missing.push('Sources');

    // Check for proper ending
    const trimmed = draft.trim();
    const endsWithPunctuation = /[.!?)\]":]$/.test(trimmed) || trimmed.endsWith('---');
    if (!endsWithPunctuation) missing.push('Proper ending (content appears cut off)');

    return { complete: missing.length === 0, missing };
  }
```

Update `validateStoryLinks` to accept type (Jumble needs min 3 links, Overclocked min 2):

```typescript
private validateStoryLinks(draft: string, type: NewsletterType): { valid: boolean; issues: string[] } {
    const minLinks = type === "overclocked" ? 2 : 3;
    // ... same logic but use minLinks instead of hardcoded 3
```

Update `validateAndFixWordCounts` to use type-aware limits:

```typescript
private async validateAndFixWordCounts(draft: string, type: NewsletterType): Promise<string> {
    const limits = WORD_LIMITS[type];
    // Replace MIN_WORDS with limits.min, MAX_WORDS with limits.max
    // Replace rewrite target 375 with limits.target
```

Update ALL calls to these methods in `writeNewsletter` to pass `newsletterType`:
- Line ~648: `this.isNewsletterComplete(draft)` → `this.isNewsletterComplete(draft, newsletterType)`
- Line ~649: `this.validateStoryLinks(draft)` → `this.validateStoryLinks(draft, newsletterType)`
- Line ~79: `this.validateAndFixWordCounts(draft)` → `this.validateAndFixWordCounts(draft, newsletterType)`

- [ ] **Step 6: Verify TypeScript compiles**

Run: `cd "C:/Users/brand/Desktop/Newsletter-main" && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add server/agents/writer.ts
git commit -m "feat: type-aware writer agent with tweet/YouTube research and Overclocked support"
```

---

## Chunk 4: Pipeline, ScoopHunter, Frontend

### Task 10: Update Publication Pipeline and Draft Service

**Files:**
- Modify: `server/orchestrator/publication-pipeline.ts`
- Modify: `server/services/draft-service.ts:23-37`
- Modify: `server/routes.ts` (publish route)

- [ ] **Step 1: Pass newsletterType through pipeline**

In `server/orchestrator/publication-pipeline.ts`, update the `execute` method to read `newsletterType` from the issue and pass it to the writer:

```typescript
// Phase 2: Generate newsletter
log("[Pipeline] Phase 2: Generating newsletter...", "pipeline");
const draft = await writerAgent.generateNewsletter(content, issue.issueNumber, issue.newsletterType || "jumble");
```

Note: After Task 2's schema migration, the `Issue` type from Drizzle includes `newsletterType` natively — no cast needed.

Also pass it to `draftService.createDraft`:

```typescript
const savedDraft = await draftService.createDraft(
  issue.issueNumber,
  draft,
  issue.id,
  newsletterType
);
```

- [ ] **Step 2: Update draft service to accept newsletterType**

In `server/services/draft-service.ts`, update `createDraft`:

```typescript
async createDraft(issueNumber: number, content: string, issueId?: string, newsletterType: string = "jumble"): Promise<NewsletterDraft> {
    const existing = await this.getDraftByIssue(issueNumber);
    if (existing) {
        throw new Error(`Draft for issue ${issueNumber} already exists`);
    }

    const [draft] = await db.insert(newsletterDrafts).values({
        issueNumber,
        content,
        issueId,
        newsletterType,
        status: 'draft'
    }).returning();

    return draft;
}
```

- [ ] **Step 3: Update publish route to accept newsletterType**

In `server/routes.ts`, in the `POST /api/issues/publish` handler, ensure `newsletterType` from the request body flows into the issue creation. Since we added the column to the schema, the `insertIssueSchema.parse(req.body)` will automatically include it if provided. No code change needed here — the schema handles it.

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd "C:/Users/brand/Desktop/Newsletter-main" && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add server/orchestrator/publication-pipeline.ts server/services/draft-service.ts server/routes.ts
git commit -m "feat: pass newsletterType through publication pipeline to draft service"
```

---

### Task 11: Add Grok to ScoopHunter Breaking Mode

**Files:**
- Modify: `server/agents/scoophunter.ts:126-146` (breaking mode section), `276-317` (after HN fetch)

- [ ] **Step 1: Import Grok service and add breaking news search**

Add import at top of `server/agents/scoophunter.ts`:

```typescript
import { grokService } from "../services/grok";
```

After the Hacker News fetch block (around line 317), add a Grok search block for breaking mode only:

```typescript
      // Fetch from Grok/X for additional breaking news coverage (breaking mode only)
      if (mode === "breaking") {
        log("[ScoopHunter] Fetching trending AI stories from X via Grok...", "agent");
        progress({ phase: "fetching X/Twitter" });
        try {
          const grokQueries = [
            "OpenAI breaking news",
            "AI trending",
            "Anthropic Claude news",
            "AI controversy viral",
          ];
          const grokStories = await grokService.searchBreakingNews(grokQueries);

          log(`[ScoopHunter] Found ${grokStories.length} Grok/X stories`, "agent");

          const grokDedupResults = await runInBatches(grokStories, 5, async (story) => {
            if (!story.url || seenUrls.has(this.cleanUrl(story.url))) return null;
            seenUrls.add(this.cleanUrl(story.url));

            try {
              const duplicateCheck = await vectorSearchService.checkDuplicate(
                story.url,
                story.title
              );
              if (duplicateCheck.isDuplicate) return null;
              if (this.isRoundupByTitle(story.title)) return null;

              const source = this.extractSource(story.url);

              return {
                title: story.title,
                url: this.cleanUrl(story.url),
                snippet: story.snippet,
                source: `${source} (X)`,
              } as Candidate;
            } catch {
              return null;
            }
          });

          allCandidates.push(
            ...grokDedupResults.filter((c): c is Candidate => c !== null)
          );
        } catch (error) {
          log(`[ScoopHunter] Grok/X fetch failed: ${error}`, "agent");
        }
      }
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd "C:/Users/brand/Desktop/Newsletter-main" && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add server/agents/scoophunter.ts
git commit -m "feat: add Grok/X as additional source for breaking news search"
```

---

### Task 12: Update Frontend

**Files:**
- Modify: `client/src/pages/editorial-desk.tsx`
- Modify: `client/src/lib/api.ts`

- [ ] **Step 1: Update publishIssue API to accept newsletterType**

In `client/src/lib/api.ts`, update the `publishIssue` function to accept and pass `newsletterType`:

```typescript
export async function publishIssue(issue: InsertIssue & { newsletterType?: string }): Promise<Issue> {
  const response = await fetch(`${API_BASE}/issues/publish`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(issue),
  });

  if (!response.ok) {
    throw new Error("Failed to publish issue");
  }

  return response.json();
}
```

- [ ] **Step 2: Add newsletter type selector to editorial desk**

In `client/src/pages/editorial-desk.tsx`:

1. Add state for newsletter type (near other useState declarations):
```typescript
const [newsletterType, setNewsletterType] = useState<"jumble" | "overclocked">("jumble");
```

2. Add a toggle near the top of the editorial desk UI (after the header/logo area). Find the appropriate location in the JSX — likely after the mobile menu or near the "Publish" button area. Add:

```tsx
<div className="flex items-center gap-2 bg-muted rounded-lg p-1">
  <button
    onClick={() => setNewsletterType("jumble")}
    className={cn(
      "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
      newsletterType === "jumble"
        ? "bg-orange-500 text-white shadow-sm"
        : "text-muted-foreground hover:text-foreground"
    )}
  >
    Jumble
  </button>
  <button
    onClick={() => setNewsletterType("overclocked")}
    className={cn(
      "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
      newsletterType === "overclocked"
        ? "bg-blue-600 text-white shadow-sm"
        : "text-muted-foreground hover:text-foreground"
    )}
  >
    Overclocked
  </button>
</div>
```

3. Update the publish mutation to include `newsletterType`. Find where `publishIssue` is called (likely in a `useMutation` or handler) and add `newsletterType` to the payload:

```typescript
// In the publish handler, add newsletterType to the issue data:
publishIssue({
  ...issueData,
  newsletterType,
})
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd "C:/Users/brand/Desktop/Newsletter-main" && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/editorial-desk.tsx client/src/lib/api.ts
git commit -m "feat: add Jumble/Overclocked newsletter type selector to editorial desk"
```

---

### Task 13: End-to-End Verification

- [ ] **Step 1: TypeScript full compile check**

Run: `cd "C:/Users/brand/Desktop/Newsletter-main" && npx tsc --noEmit`
Expected: Zero errors

- [ ] **Step 2: Start dev server and verify it boots**

Run: `cd "C:/Users/brand/Desktop/Newsletter-main" && npm run dev`
Expected: Server starts on port 5000, no crash on startup

- [ ] **Step 3: Verify Grok model ID on OpenRouter**

Check that `x-ai/grok-4.20-beta` exists on OpenRouter. If not, update `server/services/grok.ts` to use the latest available `x-ai/grok-*` model. The Grok service gracefully returns empty arrays on API errors, so this won't crash the system even if the model ID is wrong — but it won't find tweets either.

- [ ] **Step 4: Manual test — trigger a breaking search**

Via the UI or API: trigger a breaking news search and verify Grok results appear in the logs alongside Gemini and HN results.

- [ ] **Step 5: Manual test — generate a Jumble draft**

Select stories, set type to Jumble, publish. Verify the draft includes tweets, YouTube videos, polls, and stays within 200-250 word count per story.

- [ ] **Step 6: Manual test — generate an Overclocked draft**

Select stories, set type to Overclocked, publish. Verify the draft uses lowercase headers, italic teasers, Q&A sub-headers, and stays within 75-175 word count per story.

---

### Task 14: Push to GitHub

- [ ] **Step 1: Push all commits to GitHub**

```bash
cd "C:/Users/brand/Desktop/Newsletter-main" && git push origin main
```

---
