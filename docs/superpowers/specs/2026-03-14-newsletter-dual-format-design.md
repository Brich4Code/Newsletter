# Newsletter Dual-Format System + Media Integration

**Date:** 2026-03-14
**Status:** Approved

## Overview

Update the newsletter generation system to support two distinct newsletter formats (Jumble and Overclocked), add automatic tweet and YouTube video discovery, add Grok to breaking news search, remove image generation, and fix the monthly search bug.

## Newsletter Format Comparison

### Per-Story Requirements

| Per story | Overclocked | Jumble |
|-----------|-------------|--------|
| Word count | 75-175 (text convo) | 200-250 max |
| X/Twitter posts | 1 | 1-2 |
| YouTube videos | 1 | 1-2 |
| Polls (generated) | 1 | 1 |
| Embedded source links | 3-5 | 5-7 |
| Sub-headers | 2-3 lowercase Q&A | 2-3 Title Case H2 + emoji |
| Header style | lowercase + emoji at END | Title Case + emoji at START |

### Full Newsletter Structure

**Jumble:**
1. Welcome section (45-70 words, mentions both stories, ends with ⬇️)
2. "In today's newsletter:" — exactly 5 emoji bullets
3. Main Story — Title Case H1 with emoji at START, Title Case H2 subs with emojis, 200-250 words, 5-7 links, 1-2 tweets, 1-2 YouTube, 1 poll
4. Secondary Story — same format, 200-250 words
5. Weekly Scoop 🍦 — 6 emoji headlines with markdown links
6. Weekly Challenge — emoji-prefixed steps, 150-250 words
7. Wrap Up — "See you next time! 🚀"
8. Sign-off: "Stay informed, stay curious, and stay ahead with Jumble! Zoe from Jumble"
9. Sources section

**Overclocked:**
1. Date line (e.g., "Mon, March 14 at 6:00 AM")
2. Main Story — lowercase conversational headline + emoji at END, italic teaser line (e.g., `*it's ahead of ChatGPT now?*`), Q&A sub-headers (e.g., "what happened?", "👀 wait, them too?"), 75-175 words, 3-5 links, 1 tweet, 1 YouTube, 1 poll
3. Secondary Story — same format, lowercase headline + emoji at END, Q&A subs
4. weekly scoop 🍦 (lowercase) — 6 items with emojis + links, one may include YouTube
5. weekly challenge — "what's the challenge?" intro, emoji steps
6. Wrap Up — "We'd love to hear your thoughts!"
7. Sign-off: "Zoe from Overclocked"
8. Sources section

### Overclocked Story Format Example

```markdown
Canada forces OpenAI to rewrite safety rules 🚨

*a mass shooting triggers a policy overhaul*

Anthropic's Claude just overtook ChatGPT as the #1 free app...

what happened?

The "quitGPT" movement blew up on Instagram and Reddit...

> "Tweet text here" — [@username](https://x.com/username/status/123)

🎬 [Video Title](https://youtube.com/watch?v=...)

Should AI companies report concerning users?
- Yes, it's overdue
- No, privacy matters more
- Depends on the situation
```

### Poll Format

Polls are generated as plain text in the draft. Format:
```
Poll question here?
- Option A
- Option B
- Option C (optional)
```
The editor manually creates these as Beehiiv polls when publishing. The writer AI generates the question + 2-3 options based on the story's main tension. One poll per story, placed after a key revelation or claim.

## Architecture Changes

### 1. Style Guide System

**Update:** `server/config/newsletter-rules.md`
- Reduce word counts to 200-250 per story (from current 400/350)
- Add tweet embedding format: `> "tweet text" — [@handle](url)`
- Add YouTube embedding format: `🎬 [Video Title](youtube-url)`
- Add poll generation format (question + 2-3 options)
- Update date to 2026-03-14

**Create:** `server/config/newsletter-rules-overclocked.md`
- Full Overclocked format rules with examples from live newsletters
- Lowercase conversational header style
- Italic teaser line format: `*short provocative question or summary*`
- Q&A sub-header patterns (e.g., "what happened?", "👀 wait, them too?", "...but, why now?")
- 75-175 word count targets per story
- No welcome section, no TOC bullets
- Tweet and YouTube embedding (same format as Jumble)
- Poll format (same as Jumble)

**Update:** `server/config/style-guide.ts`
- Export function `getStyleGuideRules(type: "jumble" | "overclocked"): string`
- Load correct rules file based on type parameter
- Keep backward-compatible `NewsletterStyleGuide.rules` (defaults to jumble)

### 2. Grok Service (New)

**Create:** `server/services/grok.ts`

Uses OpenRouter API (same base URL and auth pattern as Perplexity service). Reuses existing `OPENROUTER_API_KEY` env var — no new env vars needed.

**Model:** `x-ai/grok-4.20-beta` (as specified by user; verify exact ID on OpenRouter before implementation — fallback to latest available `x-ai/grok-*` model if needed)

**Methods:**

`searchTweets(topic: string, count: number): Promise<TweetResult[]>`
- Prompts Grok to find recent, relevant X posts about the topic
- Returns: `{ author: string, handle: string, text: string, url: string }[]`
- Grok has native X/Twitter data access, making it ideal for this
- Used by writer Phase 1 research

`searchBreakingNews(queries: string[]): Promise<SearchResult[]>`
- Prompts Grok to find breaking AI news from X discourse
- Returns: `{ title: string, url: string, snippet: string }[]` (same `SearchResult` type as `gemini.ts`)
- Used as additional source in ScoopHunter breaking mode

### 3. YouTube Search (Add to Gemini Service)

**Update:** `server/services/gemini.ts`

Add `searchYouTube(topic: string, count: number): Promise<YouTubeResult[]>` method.
- Uses Gemini grounded search with `site:youtube.com` in the query
- Returns: `{ title: string, url: string, channel: string }[]`
- Filters for recent videos from reputable channels
- **Risk:** If `site:` operator doesn't work reliably with Gemini grounding, fallback to post-filtering regular grounded search results by `youtube.com` domain

Also fix pre-existing duplicate `temperature` property on line 78 of `generateWithFlash()`.

### 4. Writer Agent Updates

**Update:** `server/agents/writer.ts`

**Signature change:**
```typescript
async generateNewsletter(
  content: SimpleIssueContent,
  issueNumber: number,
  newsletterType: "jumble" | "overclocked" = "jumble"
): Promise<string>
```

**Phase 1 (Research)** — add parallel calls per story:
- `grokService.searchTweets(storyTitle, count)` — count=2 for Jumble, 1 for Overclocked
- `geminiService.searchYouTube(storyTitle, count)` — count=2 for Jumble, 1 for Overclocked
- Results added to research document:
  ```
  **Main Story Tweets:**
  - @handle: "tweet text" — https://x.com/...

  **Main Story YouTube:**
  - Video Title (Channel Name) — https://youtube.com/watch?v=...
  ```

**Phase 2 (Writing)** — load correct style guide:
```typescript
const rules = getStyleGuideRules(newsletterType);
```
Update the writing prompt to use `rules` instead of `NewsletterStyleGuide.rules`. The prompt template itself changes based on type (different section structure, different examples). Word count targets in the prompt must match: Jumble 225 target, Overclocked 125 target.

**Phase 2 retry loop + Phase 3 (Validation)** — all validation methods must accept `newsletterType`:
- `isNewsletterComplete(draft, type)` — Jumble checks welcome/TOC/H1s; Overclocked skips welcome/TOC, checks for lowercase headers
- `validateWeeklyScoop(draft)` — same for both (6 headlines with URLs)
- `validateStoryLinks(draft, type)` — Jumble min 3 links, Overclocked min 2 links
- `validateAndFixWordCounts(draft, type)` — Jumble 200-250 range (target 225); Overclocked 75-175 range (target 125)

**Constants to update in writer.ts:**
- Remove hardcoded `MIN_WORDS = 325`, `MAX_WORDS = 450`
- Replace with type-aware constants:
  ```typescript
  const WORD_LIMITS = {
    jumble: { min: 200, max: 250, target: 225 },
    overclocked: { min: 75, max: 175, target: 125 },
  };
  ```

### 5. ScoopHunter — Add Grok to Breaking Mode

**Update:** `server/agents/scoophunter.ts`
- In `mode === "breaking"`: after Gemini search + HN fetch, also call `grokService.searchBreakingNews()` with a subset of breaking queries
- Grok results returned as `SearchResult[]` — same dedup/scoring pipeline as Gemini results
- Grok catches stories trending on X before traditional news outlets

### 6. Remove Image Generation

**Delete:** `server/agents/illustrator.ts` — entire file

**Update:** `server/orchestrator/publication-pipeline.ts`
- Remove Phase 3 (hero image generation) entirely
- Remove `illustratorAgent` import
- Pipeline becomes: prepare content → generate draft → save draft → update issue

**Update:** `server/routes.ts`
- Remove `/api/drafts/:id/generate-image` route
- Remove `/api/drafts/:id/regenerate-image` route
- Remove `/api/drafts/:id/generate-prompt` route

**Update:** `server/services/gemini.ts`
- Remove `generateImage()` method (Pollinations.ai integration)

**Keep:** DB fields (`heroImageUrl`, `heroImagePrompt`) for backward compat — just never populated.

### 7. Fix Monthly Search Bug

**Root cause investigation:**
1. Add detailed logging at entry point of `scoopHunterAgent.run("monthly")` to confirm it starts
2. Log each search query and whether Gemini returns results
3. Log candidate count after dedup filtering
4. Log scoring results (how many pass MIN_RELEVANCE_SCORE threshold)
5. Check if `isRunning` flag could be stuck from a prior failed run — add a staleness timeout (e.g., if `startedAt` is >30 min ago, force-reset the flag)
6. Test whether Gemini grounded search properly interprets `after:YYYY-MM-DD` for 30-day-old dates

**Frontend:** Verify the editorial desk re-fetches leads after monthly search completes (the leads query should refetch on interval or after research status changes to "completed").

### 8. Schema + API Changes

**Update:** `shared/schema.ts`
- Add `newsletterType` column to `issues` table: `newsletterType: text("newsletter_type").default("jumble").notNull()`
- Add `newsletterType` column to `newsletter_drafts` table: `newsletterType: text("newsletter_type").default("jumble").notNull()`

**Migration:** Run `ALTER TABLE` via Drizzle migration or direct SQL on Supabase:
```sql
ALTER TABLE issues ADD COLUMN newsletter_type text NOT NULL DEFAULT 'jumble';
ALTER TABLE newsletter_drafts ADD COLUMN newsletter_type text NOT NULL DEFAULT 'jumble';
```

**Update:** `server/routes.ts`
- `/api/issues/publish` reads `newsletterType` from request body
- Passes to `publicationPipeline.execute()`

**Update:** `server/orchestrator/publication-pipeline.ts`
- `execute(issue: Issue)` reads `issue.newsletterType`
- Passes to `writerAgent.generateNewsletter(content, issueNumber, issue.newsletterType)`

**Update:** `server/services/draft-service.ts`
- `createDraft()` accepts and stores `newsletterType` on the draft record

**Update:** `server/storage.ts`
- No interface changes needed — Drizzle handles new columns automatically via schema types

### 9. Frontend Changes

**Update:** `client/src/pages/editorial-desk.tsx`
- Add newsletter type toggle (Jumble / Overclocked) near the top of the editorial desk
- Selected type stored in component state (default: "jumble")
- Passed to `publishIssue()` API call
- Visual indicator showing which format is active (different accent color or label)

**Update:** `client/src/lib/api.ts`
- `publishIssue()` accepts and sends `newsletterType` field in request body

## Files Touched

| File | Action |
|------|--------|
| `server/config/newsletter-rules.md` | Update (word counts, tweet/YouTube/poll format) |
| `server/config/newsletter-rules-overclocked.md` | Create |
| `server/config/style-guide.ts` | Update (type-aware loading) |
| `server/services/grok.ts` | Create |
| `server/services/gemini.ts` | Update (add YouTube search, remove generateImage, fix dupe temp) |
| `server/services/draft-service.ts` | Update (accept newsletterType) |
| `server/agents/writer.ts` | Update (type-aware research, writing, validation, word counts) |
| `server/agents/scoophunter.ts` | Update (add Grok to breaking) |
| `server/agents/illustrator.ts` | Delete |
| `server/orchestrator/publication-pipeline.ts` | Update (remove image gen, pass type) |
| `server/orchestrator/research-loop.ts` | Update (fix monthly bug, add staleness timeout) |
| `server/routes.ts` | Update (remove image routes, accept type) |
| `shared/schema.ts` | Update (add newsletterType columns) |
| `client/src/pages/editorial-desk.tsx` | Update (type selector) |
| `client/src/lib/api.ts` | Update (pass type) |

## Implementation Order

1. Fix monthly search bug (quick win, unblocks testing)
2. Schema migration (add newsletterType columns)
3. Create Grok service
4. Add YouTube search to Gemini service (+ fix dupe temp bug, remove generateImage)
5. Create Overclocked style guide
6. Update Jumble style guide (word counts + media format)
7. Update style-guide.ts (type-aware loading)
8. Update writer agent (type-aware research, writing, validation, word counts)
9. Update publication pipeline (remove image gen, pass newsletterType, update draft-service)
10. Delete illustrator.ts + remove image routes
11. Update ScoopHunter (Grok in breaking mode)
12. Update frontend (type selector + API)
13. End-to-end testing
