# Hello Jumble Agentic Newsroom - Setup Guide

## Overview

The Hello Jumble Agentic Newsroom is a hybrid AI + manual system:
- **Agents** continuously research and curate news (background process)
- **You** select stories via the editorial desk UI
- **Agents** generate polished newsletters in Google Docs when you publish

---

## Prerequisites

- Node.js 18+
- PostgreSQL database (with pgvector extension)
- Google Cloud account with APIs enabled
- Replit Secrets (or `.env` file)

---

## Step 1: Database Setup

### Install pgvector Extension

Your PostgreSQL database needs the `pgvector` extension for semantic search:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### Run Migrations

```bash
npm run db:push
```

This will create the following tables:
- `leads` - News story candidates
- `challenges` - Weekly coding challenges
- `issues` - Published newsletter issues
- `newsletter_history` - Deduplication tracking
- `newsletter_backlog` - Future story ideas

---

## Step 2: Google Cloud Setup

### 1. Enable Required APIs

Go to [Google Cloud Console](https://console.cloud.google.com/) and enable:
- **Gemini API** (Generative Language API)
- **Google Docs API**
- **Google Drive API**
- **Vertex AI API** (optional, for Imagen)

### 2. Create Service Account

1. Navigate to **IAM & Admin** → **Service Accounts**
2. Click **Create Service Account**
3. Name it: `hello-jumble-newsroom`
4. Grant roles:
   - **Editor** (for Docs and Drive)
5. Click **Done**

### 3. Create Service Account Key

1. Click on the service account you just created
2. Go to **Keys** tab
3. Click **Add Key** → **Create New Key**
4. Choose **JSON** format
5. Download the key file

### 4. Extract Credentials

Open the downloaded JSON file and copy:
- `client_email` → This is your `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `private_key` → This is your `GOOGLE_PRIVATE_KEY`

### 5. Get Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Click **Get API Key**
3. Copy the API key → This is your `GOOGLE_AI_API_KEY`

### 6. Create Google Drive Folder

1. Go to [Google Drive](https://drive.google.com/)
2. Create a new folder: "Hello Jumble Drafts"
3. Right-click the folder → **Share**
4. Share with your service account email (`GOOGLE_SERVICE_ACCOUNT_EMAIL`) as **Editor**
5. Copy the folder ID from the URL:
   - URL: `https://drive.google.com/drive/folders/1ABC...XYZ`
   - Folder ID: `1ABC...XYZ`

---

## Step 3: Environment Variables

### Using Replit Secrets

Add the following secrets in your Replit project:

```bash
DATABASE_URL=postgresql://...
GOOGLE_AI_API_KEY=your_gemini_api_key
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_DOCS_FOLDER_ID=your_folder_id
EDITOR_EMAIL=your-email@example.com
RESEARCH_INTERVAL_HOURS=6
```

**Important:** The `GOOGLE_PRIVATE_KEY` must include the `\n` newlines as-is.

### Using `.env` File (Local Development)

```bash
cp .env.example .env
# Edit .env with your actual values
```

---

## Step 4: Install Dependencies

```bash
npm install
```

---

## Step 5: Start the Application

### Development Mode

```bash
npm run dev
```

The server will:
1. Start on port 5000
2. Launch the background research loop (runs every 6 hours)
3. Serve the editorial desk UI

### Production Mode

```bash
npm run build
npm start
```

---

## Step 6: Verify Setup

### 1. Check Research Loop

Wait 30 seconds after startup, then check the console logs:

```
[ScoopHunter] Starting research cycle...
[ScoopHunter] Searching: latest AI breakthroughs...
[ScoopHunter] Found 15 unique candidates
[ScoopHunter] Stored 8 new leads
```

### 2. Check Database

```sql
SELECT COUNT(*) FROM leads;
```

You should see leads being populated.

### 3. Open Editorial Desk

Navigate to: `http://localhost:5000`

You should see:
- Fresh leads in the "Incoming Wire" panel
- Challenges in the "Weekly Challenge" section

### 4. Test Publishing

1. Select a main story
2. Optionally select secondary story and quick links
3. Select a challenge
4. Click **Publish Issue**
5. Wait 30-60 seconds
6. Check your email for a link to the Google Doc
7. Alternatively, query the database:

```sql
SELECT google_docs_url FROM issues ORDER BY published_at DESC LIMIT 1;
```

---

## How It Works

### Background Research (Continuous)

Every 6 hours (configurable):
1. **ScoopHunter** searches for AI news using Gemini + Google Search
2. Checks for duplicates using vector similarity
3. Scores relevance (0-100)
4. Stores high-quality leads (70+) in database
5. **Challenge Generator** creates new coding challenges (Mondays only)

### Publication Pipeline (On-Demand)

When you click "Publish Issue":
1. **Investigator** fact-checks the main story (verifies URL, finds primary source)
2. **Writer** generates newsletter draft following your style guide
3. **Compliance Officer** validates formatting rules
4. Auto-fixes violations (up to 3 attempts)
5. **Illustrator** generates hero image (optional)
6. **Google Docs Service** creates formatted document
7. Shares with your email
8. Returns Google Docs URL

---

## Configuration

### Research Interval

Change how often agents search for news:

```env
RESEARCH_INTERVAL_HOURS=6  # Default: every 6 hours
```

### Newsletter Style Guide

Edit the style guide rules:

```
server/config/style-guide.ts
```

### Agent Behavior

Modify agent logic in:

```
server/agents/
  ├── scoophunter.ts       # Research parameters
  ├── writer.ts            # Writing style
  ├── compliance-officer.ts # Validation rules
  └── ...
```

---

## Troubleshooting

### No Leads Appearing

**Symptom:** Editorial desk is empty after waiting

**Solution:**
1. Check console logs for errors
2. Verify `GOOGLE_AI_API_KEY` is correct
3. Manually trigger research:

```bash
# Add this route to server/routes.ts for debugging:
app.post("/api/research/trigger", async (req, res) => {
  await researchOrchestrator.triggerManualCycle();
  res.json({ status: "triggered" });
});
```

### Google Docs Creation Fails

**Symptom:** Publishing completes but no Google Doc

**Solution:**
1. Verify service account has access to the Drive folder
2. Check `GOOGLE_PRIVATE_KEY` includes `\n` newlines
3. Ensure Google Docs API is enabled

### Compliance Violations

**Symptom:** "Could not fix violations after 3 attempts"

**Solution:**
1. Check the violations in console logs
2. Update writer prompt to emphasize the specific rules
3. Adjust compliance validation thresholds

### Database Connection Issues

**Symptom:** "DATABASE_URL must be set"

**Solution:**
1. Verify `DATABASE_URL` in Replit Secrets or `.env`
2. Ensure pgvector extension is installed
3. Run `npm run db:push` to create tables

---

## Monitoring

### View Logs

All agents log their activity with timestamps:

```
[ScoopHunter] Starting research cycle...
[Writer] Generating newsletter draft...
[Compliance] ✓ Validation passed
[Pipeline] ✓ Publication complete: https://docs.google.com/...
```

### Check Issue Status

Query published issues:

```sql
SELECT
  issue_number,
  published_at,
  google_docs_url,
  (SELECT COUNT(*) FROM leads WHERE id = issues.main_story_id) as has_main_story
FROM issues
ORDER BY published_at DESC
LIMIT 5;
```

---

## Next Steps

1. ✅ Complete setup following this guide
2. ✅ Let background research run for 6-12 hours to build a lead inventory
3. ✅ Test publishing a newsletter issue
4. ✅ Review the generated Google Doc
5. ✅ Adjust style guide if needed
6. ✅ Set up a cron job or scheduler for regular issues

---

## Support

For issues or questions, check:
- `IMPLEMENTATION_PLAN.md` for architecture details
- Console logs for error messages
- Google Cloud Console for API quota/errors
