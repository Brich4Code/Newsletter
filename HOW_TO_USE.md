# How to Use - Hello Jumble Agentic Newsroom

## Quick Start

### 1. Start the App
```bash
npm run dev
```

### 2. Open Editorial Desk
Navigate to: `http://localhost:5000`

### 3. Find Stories
Click the **"Find Stories"** button in the "Incoming Wire" panel.

This triggers the AI agents to:
- Search Google for recent AI news
- Score relevance (0-100)
- Check for duplicates
- Store high-quality leads in the database

**Wait 2-5 minutes**, then click the refresh button to see new leads appear.

### 4. Select Content
- Click **"Main"** on a lead to make it the feature story
- Click **"Secondary"** on another lead for the secondary story
- Click **"Link"** on 6 leads to add them to Quick Hits
- Select a **Weekly Challenge** from the list

### 5. Publish Issue
Click **"Publish Issue"** when ready.

The system will:
1. Fact-check the main story
2. Generate a complete newsletter draft
3. Validate against style guide rules
4. Create a formatted Google Doc
5. Share it with your email

**Wait 30-60 seconds**, then check your email or the database for the Google Docs link.

---

## The "Find Stories" Button

When you click "Find Stories":

1. **ScoopHunter Agent** runs:
   - Searches: "latest AI breakthroughs", "new AI models", "AI startup funding", etc.
   - Uses Gemini + Google Search Grounding
   - Finds 20-30 candidates

2. **Duplicate Check**:
   - Checks against URL history
   - Semantic similarity search (85% threshold)
   - Only keeps truly unique stories

3. **Scoring**:
   - Each story scored 0-100 for relevance
   - Only stores leads scoring 70+
   - Generates 1-2 sentence summaries

4. **Storage**:
   - Saves to `leads` table
   - Adds to `newsletter_history` for future deduplication

You'll see console logs like:
```
[ScoopHunter] Starting research cycle...
[ScoopHunter] Searching: latest AI breakthroughs...
[ScoopHunter] Found 15 unique candidates
[ScoopHunter] Scored: "OpenAI releases GPT-5" = 95/100
[ScoopHunter] Stored 8 new leads
```

---

## Workflow

```
┌─────────────────────────────────────────┐
│  1. Click "Find Stories"                │
│     (2-5 minutes)                       │
└─────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────┐
│  2. Leads appear in "Incoming Wire"     │
│     - Sorted by relevance score         │
│     - Unique stories only               │
└─────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────┐
│  3. Select stories manually             │
│     - Main story (required)             │
│     - Secondary story (optional)        │
│     - 6 Quick Links                     │
│     - 1 Challenge                       │
└─────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────┐
│  4. Click "Publish Issue"               │
│     (30-60 seconds)                     │
└─────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────┐
│  5. Google Doc created                  │
│     - Formatted newsletter              │
│     - All style rules enforced          │
│     - Shared with your email            │
└─────────────────────────────────────────┘
```

---

## Tips

### Get More Leads
- Click "Find Stories" multiple times (wait 5 min between clicks)
- Stories persist in database until you manually delete them
- Run daily to build up a good inventory

### Check Lead Quality
- Higher relevance scores = better stories
- Source matters: look for reputable outlets
- Read the summary before selecting

### Monitor Progress
Watch the console logs:
- `[ScoopHunter]` = Research activity
- `[Writer]` = Newsletter generation
- `[Compliance]` = Rule validation
- `[Pipeline]` = Publication status

### Refresh the View
- Click the refresh icon to reload leads
- New leads appear sorted by relevance score
- Badge shows current lead count

---

## Environment Variables Needed

Before using, ensure these are set in Replit Secrets:

```
GOOGLE_AI_API_KEY=...              # From Google AI Studio
GOOGLE_SERVICE_ACCOUNT_EMAIL=...   # Service account email
GOOGLE_PRIVATE_KEY=...             # Service account private key
GOOGLE_DOCS_FOLDER_ID=...          # Drive folder ID
EDITOR_EMAIL=your@email.com        # Your email
DATABASE_URL=postgresql://...      # Replit provides this
```

See `SETUP_GUIDE.md` for detailed setup instructions.

---

## What Happens Behind the Scenes

### Finding Stories (2-5 minutes)
1. Gemini searches Google for AI news
2. Extracts titles, URLs, snippets
3. Generates embeddings for semantic matching
4. Checks duplicates against history
5. Scores relevance using AI
6. Writes summaries
7. Stores in database

### Publishing (30-60 seconds)
1. Fetches your selected stories from database
2. Fact-checks main story (verifies URL is live)
3. Generates 400-word main story, 350-word secondary
4. Creates 6 Quick Hits headlines
5. Adds Weekly Challenge
6. Validates 9 compliance rules
7. Auto-fixes any violations
8. Converts Markdown → Google Docs format
9. Creates document with proper formatting
10. Shares with your email
11. Saves Google Docs URL to database

---

## Troubleshooting

### "Find Stories" button doesn't work
- Check console for errors
- Verify `GOOGLE_AI_API_KEY` is set
- Make sure database is connected

### No leads appear after 5 minutes
- Check console logs for `[ScoopHunter]` errors
- Verify API key has quota remaining
- Try clicking "Find Stories" again

### Publishing fails
- Check all required env variables are set
- Verify service account has access to Drive folder
- Review console logs for specific error

### Google Doc not created
- Ensure Google Docs API is enabled
- Verify `GOOGLE_PRIVATE_KEY` has `\n` newlines
- Check service account email is shared on folder

---

## Next Steps

1. ✅ Set up environment variables (see `SETUP_GUIDE.md`)
2. ✅ Run the app: `npm run dev`
3. ✅ Click "Find Stories" to populate leads
4. ✅ Select stories and publish your first issue
5. ✅ Review the generated Google Doc
6. ✅ Adjust style guide if needed (`server/config/style-guide.ts`)

The system is ready to use! Just click "Find Stories" whenever you need fresh content.
