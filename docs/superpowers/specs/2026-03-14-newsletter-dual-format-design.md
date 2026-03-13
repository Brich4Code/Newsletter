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
2. Main Story — lowercase conversational headline + emoji at END, short italic teaser, Q&A sub-headers (e.g., "what happened?", "👀 wait, them too?"), 75-175 words, 3-5 links, 1 tweet, 1 YouTube, 1 poll
3. Secondary Story — same format, lowercase headline + emoji at END, Q&A subs
4. weekly scoop 🍦 (lowercase) — 6 items with emojis + links, one may include YouTube
5. weekly challenge — "what's the challenge?" intro, emoji steps
6. Wrap Up — "We'd love to hear your thoughts!"
7. Sign-off: "Zoe from Overclocked"
8. Sources section

## Architecture Changes

### 1. Style Guide System

**Update:** `server/config/newsletter-rules.md`
- Reduce word counts to 200-250 per story
- Add tweet embedding format instructions
- Add YouTube embedding format instructions
- Add poll generation instructions

**Create:** `server/config/newsletter-rules-overclocked.md`
- Full Overclocked format rules with examples from live newsletters
- Lowercase conversational header style
- Q&A sub-header patterns
- 75-175 word count targets
- No welcome section, no TOC bullets

**Update:** `server/config/style-guide.ts`
- Accept `newsletterType` parameter
- Load correct rules file dynamically

### 2. Grok Service (New)

**Create:** `server/services/grok.ts`
- Uses `x-ai/grok-4.20-beta` via OpenRouter (same pattern as Perplexity service)
- `searchTweets(topic: string, count: number)` — finds relevant X posts for a story topic
  - Returns: `{ author, handle, text, url, engagement }[]`
  - Grok has native X/Twitter data access
- `searchBreakingNews(queries: string[])` — finds breaking AI news from X discourse
  - Returns candidates in same format as Gemini grounded search
  - Used as additional source in ScoopHunter breaking mode

### 3. YouTube Search (Add to Gemini Service)

**Update:** `server/services/gemini.ts`
- Add `searchYouTube(topic: string, count: number)` method
- Uses Gemini grounded search with `site:youtube.com` prefix
- Returns: `{ title, url, channel }[]`
- Filters for recent, relevant videos from reputable channels

### 4. Writer Agent Updates

**Update:** `server/agents/writer.ts`

**`generateNewsletter()`** accepts new `newsletterType` parameter.

**Phase 1 (Research)** — add parallel calls:
- For each story: Grok finds tweets, Gemini finds YouTube videos
- Results added to research document as new sections:
  ```
  **Main Story Tweets:**
  - @handle: "tweet text" — https://x.com/...

  **Main Story YouTube:**
  - Video Title (Channel Name) — https://youtube.com/watch?v=...
  ```

**Phase 2 (Writing)** — load correct style guide based on type. The writing prompt structure changes per type but the Gemini generation call stays the same.

**Phase 3 (Validation)** — branch on type:
- Jumble: check welcome, TOC, Title Case H1/H2, 200-250 word range, tweets/YouTube present
- Overclocked: skip welcome/TOC, check lowercase headers, 75-175 word range, tweets/YouTube present

### 5. ScoopHunter — Add Grok to Breaking Mode

**Update:** `server/agents/scoophunter.ts`
- In `mode === "breaking"`: after Gemini search + HN, also call `grokService.searchBreakingNews()` with trending AI queries
- Deduplicate Grok results against existing candidates (same URL + semantic check)
- Grok's X data access catches stories trending on social media before traditional news outlets

### 6. Remove Image Generation

**Update:** `server/orchestrator/publication-pipeline.ts`
- Remove Phase 3 (hero image generation) entirely
- Remove `illustratorAgent` import and calls
- Pipeline becomes: prepare content → generate draft → save draft → update issue

**Update:** `server/routes.ts`
- Remove `/api/drafts/:id/generate-image`
- Remove `/api/drafts/:id/regenerate-image`
- Remove `/api/drafts/:id/generate-prompt`

**Keep:** DB fields (`heroImageUrl`, `heroImagePrompt`) for backward compat — just never populated.

### 7. Fix Monthly Search Bug

**Investigate:** `server/orchestrator/research-loop.ts` + `server/agents/scoophunter.ts`
- Add logging to confirm monthly mode actually enters the search loop
- Add logging for how many candidates pass dedup + scoring
- The `isRunning` mutex resets in `finally` block (looks correct), but add a safety timeout
- Check if Gemini grounded search handles the `after:YYYY-MM-DD` filter correctly for 30-day ranges
- Verify the frontend refreshes leads after monthly search completes

### 8. Schema + API Changes

**Update:** `shared/schema.ts`
- Add `newsletterType` column to `issues` table (text, default "jumble")
- Add `newsletterType` column to `newsletter_drafts` table (text, default "jumble")

**Update:** `server/routes.ts`
- `/api/issues/publish` accepts `newsletterType` in request body
- Passes type through to publication pipeline

**Update:** `server/storage.ts`
- No interface changes needed — existing `createIssue()` handles new column via schema

### 9. Frontend Changes

**Update:** `client/src/pages/editorial-desk.tsx`
- Add newsletter type toggle (Jumble / Overclocked) at top of editorial desk
- Selected type stored in state
- Passed to publish API call
- Visual indicator showing which format is active

**Update:** `client/src/lib/api.ts`
- `publishIssue()` accepts and sends `newsletterType`

## Files Touched

| File | Action |
|------|--------|
| `server/config/newsletter-rules.md` | Update (word counts, tweet/YouTube/poll format) |
| `server/config/newsletter-rules-overclocked.md` | Create |
| `server/config/style-guide.ts` | Update (type-aware loading) |
| `server/services/grok.ts` | Create |
| `server/services/gemini.ts` | Update (add YouTube search) |
| `server/agents/writer.ts` | Update (type-aware generation + validation) |
| `server/agents/scoophunter.ts` | Update (add Grok to breaking) |
| `server/orchestrator/publication-pipeline.ts` | Update (remove image gen, pass type) |
| `server/orchestrator/research-loop.ts` | Update (fix monthly bug) |
| `server/routes.ts` | Update (remove image routes, accept type) |
| `shared/schema.ts` | Update (add newsletterType columns) |
| `client/src/pages/editorial-desk.tsx` | Update (type selector) |
| `client/src/lib/api.ts` | Update (pass type) |

## Implementation Order

1. Fix monthly search bug (quick win, unblocks testing)
2. Schema migration (add newsletterType)
3. Create Grok service
4. Add YouTube search to Gemini service
5. Create Overclocked style guide
6. Update Jumble style guide (word counts + media format)
7. Update style-guide.ts (type-aware loading)
8. Update writer agent (type-aware research, writing, validation)
9. Update ScoopHunter (Grok in breaking mode)
10. Remove image generation from pipeline + routes
11. Update frontend (type selector + API)
12. End-to-end testing
