# What's New - Agentic Newsroom Implementation

## Summary

Your Hello Jumble application has been transformed from a manual editorial interface into a **fully agentic newsroom system** that:
- ✅ Continuously researches AI news in the background
- ✅ Curates and scores leads automatically
- ✅ Lets you select stories via the existing UI (unchanged)
- ✅ Generates polished newsletter drafts in Google Docs
- ✅ Enforces your exact style guide rules

---

## What Was Added

### 1. Database Schema Extensions

**File:** `shared/schema.ts`

Added:
- Vector embeddings to `leads` table (768-dimensional)
- `factCheckStatus` and `primarySourceUrl` fields
- `newsletter_history` table for deduplication
- `newsletter_backlog` table for future story ideas

### 2. Google API Integration

**Dependencies Installed:**
- `@google/generative-ai` - Gemini AI models
- `googleapis` - Google Docs and Drive APIs
- `@google-cloud/aiplatform` - Vertex AI (for future image generation)

### 3. Core Services Layer

**New Files:**

**`server/services/gemini.ts`**
- Wraps Gemini Flash (fast) and Pro (powerful) models
- Handles search grounding for research
- Generates text embeddings (text-embedding-004)
- JSON output parsing

**`server/services/google-docs.ts`**
- Creates formatted Google Docs from Markdown
- Parses headers (#, ##, ###), bold (**text**), links ([text](url))
- Inserts hero images
- Shares documents with editor email
- Moves to specific folder

**`server/services/vector-search.ts`**
- Semantic duplicate detection
- Cosine similarity search (85% threshold)
- Adds stories to history for future deduplication

### 4. Intelligent Agents

**New Files:**

**`server/agents/scoophunter.ts`**
- Searches Google for AI news using Gemini + Search Grounding
- Scores relevance (0-100) based on newsworthiness
- Deduplicates against history (URL + semantic)
- Stores high-quality leads (70+) in database
- Runs every 6 hours (configurable)

**`server/agents/writer.ts`**
- Generates newsletter drafts using Gemini Pro
- Follows your exact style guide rules
- Creates all sections: Welcome, Main Story, Secondary, Weekly Scoop, Challenge
- Embeds links naturally over 3-9 word phrases
- 400-word main story, 350-word secondary story

**`server/agents/compliance-officer.ts`**
- Validates drafts against 9 critical rules:
  1. No punctuation in headers
  2. No bare URLs
  3. No emojis in body text
  4. No "click here" links
  5. No duplicate URLs
  6. No tracking parameters
  7. Proper header syntax (#)
  8. Minimal "According to" usage
  9. Word count targets
- Auto-fixes violations using Gemini (up to 3 attempts)

**`server/agents/investigator.ts`**
- Fact-checks stories before publication
- Verifies URLs are live (HTTP HEAD request)
- Finds primary sources (original papers, announcements)
- Flags failed verification

**`server/agents/illustrator.ts`**
- Generates hero image prompts
- Placeholder for Imagen API integration

**`server/agents/challenge-generator.ts`**
- Creates 3 weekly coding challenges
- Runs every Monday
- Difficulty: Beginner to intermediate
- Duration: 30-60 minutes

### 5. Orchestration Systems

**`server/orchestrator/research-loop.ts`**
- Background process that runs every N hours
- Coordinates ScoopHunter and Challenge Generator
- Prevents overlapping cycles
- Manual trigger support (for testing)

**`server/orchestrator/publication-pipeline.ts`**
- 7-phase workflow:
  1. Fetch all content
  2. Fact-check main story
  3. Generate draft (Writer)
  4. Validate compliance (auto-fix if needed)
  5. Generate hero image
  6. Create Google Doc
  7. Update database with URL
- Returns Google Docs URL or error details

### 6. Configuration

**`server/config/style-guide.ts`**
- Complete style guide from your rules document
- Template structure definitions
- Validation patterns
- Example newsletter format

### 7. API Updates

**File:** `server/routes.ts`

Modified:
- `POST /api/issues/publish` now triggers the publication pipeline
- Returns immediately with "processing" status
- Pipeline runs asynchronously in background

### 8. Server Startup Integration

**File:** `server/index.ts`

Added:
- Research orchestrator starts on server launch
- First research cycle runs immediately
- Then repeats every 6 hours (configurable)

### 9. Storage Layer Enhancements

**File:** `server/storage.ts`

Added methods:
- `getLeadById()` - Fetch single lead
- `getLeadsByIds()` - Fetch multiple leads
- `getChallengeById()` - Fetch single challenge
- `updateIssue()` - Update issue with Google Docs URL

---

## File Structure (New)

```
server/
  ├── agents/
  │   ├── scoophunter.ts
  │   ├── writer.ts
  │   ├── compliance-officer.ts
  │   ├── investigator.ts
  │   ├── illustrator.ts
  │   └── challenge-generator.ts
  ├── services/
  │   ├── gemini.ts
  │   ├── google-docs.ts
  │   └── vector-search.ts
  ├── orchestrator/
  │   ├── research-loop.ts
  │   └── publication-pipeline.ts
  ├── config/
  │   └── style-guide.ts
  ├── routes.ts (modified)
  ├── index.ts (modified)
  └── storage.ts (modified)

shared/
  └── schema.ts (extended)

.env.example (new)
SETUP_GUIDE.md (new)
IMPLEMENTATION_PLAN.md (existing)
```

---

## What Stayed the Same

### Frontend (Unchanged)
- `client/src/pages/editorial-desk.tsx` - Your editorial interface
- All UI components
- Selection workflow (main, secondary, links, challenge)

The UI experience is identical - you still manually select stories. The difference is that the wire feed is now **automatically populated** by agents.

---

## How to Use

### 1. Setup (One-Time)

Follow `SETUP_GUIDE.md`:
1. Install dependencies: `npm install`
2. Configure Google Cloud (APIs, Service Account)
3. Set environment variables (Replit Secrets)
4. Run migrations: `npm run db:push`

### 2. Start the System

```bash
npm run dev
```

You'll see logs like:
```
[Orchestrator] Starting background research (interval: 6h)
[ScoopHunter] Starting research cycle...
[ScoopHunter] Found 15 unique candidates
[ScoopHunter] Stored 8 new leads
```

### 3. Wait for Leads

The first research cycle takes 2-5 minutes. After that:
- Refresh the editorial desk
- You'll see leads appearing in the "Incoming Wire"

### 4. Publish an Issue

1. Select stories from the wire
2. Select a challenge
3. Click "Publish Issue"
4. Wait 30-60 seconds
5. Check the database or your email for the Google Docs link

---

## Environment Variables Required

```env
# Database
DATABASE_URL=postgresql://...

# Google AI
GOOGLE_AI_API_KEY=...

# Google Docs
GOOGLE_SERVICE_ACCOUNT_EMAIL=...
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_DOCS_FOLDER_ID=...

# Newsletter
EDITOR_EMAIL=your-email@example.com

# Configuration
RESEARCH_INTERVAL_HOURS=6
```

---

## Testing Checklist

- [ ] Server starts without errors
- [ ] Research cycle runs and logs activity
- [ ] Leads appear in database (`SELECT * FROM leads`)
- [ ] Leads appear in editorial desk UI
- [ ] Can select stories and challenges
- [ ] "Publish Issue" returns processing status
- [ ] Google Doc is created within 60 seconds
- [ ] Google Doc has proper formatting (headers, bold, links)
- [ ] Google Doc is shared with editor email
- [ ] No bare URLs in document
- [ ] No punctuation in headers
- [ ] Links are natural 3-9 word phrases

---

## Next Steps

1. **Test the System**: Follow the testing checklist above
2. **Adjust Style Guide**: Modify `server/config/style-guide.ts` if needed
3. **Tune Agents**: Adjust search queries, scoring logic, etc.
4. **Enable Image Generation**: Configure Imagen API when ready
5. **Monitor Performance**: Watch logs for any errors or bottlenecks

---

## Support

All documentation is in:
- `SETUP_GUIDE.md` - Step-by-step setup instructions
- `IMPLEMENTATION_PLAN.md` - Detailed architecture
- This file - What was added and how to use it

The system is ready to run! Just add your environment variables and start the server.
