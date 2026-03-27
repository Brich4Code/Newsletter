import { geminiService } from "../services/gemini";
import { perplexityService } from "../services/perplexity";
import { grokService } from "../services/grok";
import { getStyleGuideRules, type NewsletterType } from "../config/style-guide";
import { log } from "../index";

const WORD_LIMITS = {
  jumble: { min: 200, max: 250, target: 225 },
  overclocked: { min: 75, max: 175, target: 125 },
};

/**
 * Escape special characters that could break template literals
 * Handles backticks, ${} expressions, and backslashes
 */
function escapeForTemplateLiteral(str: string | undefined | null): string {
  if (!str) return '';
  return str
    .replace(/\\/g, '\\\\')     // Escape backslashes first
    .replace(/`/g, '\\`')       // Escape backticks
    .replace(/\$\{/g, '\\${');  // Escape template expressions
}

/**
 * Simple story topic - just a title and optional URL
 * AI will research and fact-check using grounded search
 */
export interface StoryTopic {
  title: string;
  url?: string; // Optional - AI can find sources if not provided
  note?: string; // Editorial note to guide LLM when writing about this story
}

/**
 * Simplified input format - just story topics
 * No pre-fetched summaries, no complex Lead objects
 */
export interface SimpleIssueContent {
  mainStory: StoryTopic;
  secondaryStory?: StoryTopic;
  quickLinks?: StoryTopic[]; // AI will find 6 stories if not provided
  challenge?: {
    title: string;
    description?: string;
  };
}

/**
 * Simplified Writer Agent
 *
 * NEW APPROACH - Leverage AI's native power:
 * 1. Phase 1 (Perplexity): Research stories with verified URLs and fact-checking (full research, no condensation)
 * 2. Phase 2 (Gemini Flash Preview): Write newsletter following style guide
 * 3. Phase 3 (Auto Word Count Fix): Validate word counts per type, rewrite if needed (preserves links)
 *
 * REMOVED:
 * - Pre-fetched story summaries
 * - Separate investigator agent
 * - Separate compliance officer agent
 * - Complex prompt building with embedded content
 * - Gemini grounded search (replaced with Perplexity for better URL accuracy)
 * - Research condensation (was causing issues)
 *
 * The AI does what it does best: search, research, and write.
 */
export class WriterAgent {
  /**
   * Generate newsletter from simple story topics
   * AI handles research, fact-checking, and writing
   */
  async generateNewsletter(
    content: SimpleIssueContent,
    issueNumber: number,
    newsletterType: NewsletterType = "jumble"
  ): Promise<string> {
    log(`[Writer] Starting ${newsletterType} newsletter generation...`, "agent");

    try {
      // Phase 1: Research and fact-check using Perplexity (verified URLs)
      log("[Writer Phase 1] Researching and fact-checking stories with Perplexity...", "agent");
      const research = await this.researchStories(content, newsletterType);

      // Phase 2: Write newsletter using Gemini Flash Preview
      log("[Writer Phase 2] Writing newsletter...", "agent");
      let draft = await this.writeNewsletter(research, issueNumber, newsletterType);

      // Phase 3: Validate and fix word counts
      log("[Writer Phase 3] Validating word counts...", "agent");
      draft = await this.validateAndFixWordCounts(draft, newsletterType);

      log("[Writer] Draft generated successfully", "agent");
      return draft;
    } catch (error) {
      log(`[Writer] Error: ${error}`, "agent");
      throw new Error(`Failed to generate newsletter: ${error}`);
    }
  }

  /**
   * Phase 1: Research all stories using Perplexity
   * Perplexity provides verified URLs and fact-checked information
   */
  private async researchStories(content: SimpleIssueContent, newsletterType: NewsletterType): Promise<string> {
    const researchPrompts: { category: string; prompt: string }[] = [];

    // Main story research - escape all dynamic content
    const mainTitle = escapeForTemplateLiteral(content.mainStory.title);
    const mainUrl = escapeForTemplateLiteral(content.mainStory.url);
    const mainNote = escapeForTemplateLiteral(content.mainStory.note);

    researchPrompts.push({
      category: "Main Story",
      prompt: `Research this AI news story in detail: "${mainTitle}"${mainUrl ? `\nOriginal source: ${mainUrl}` : ''}${mainNote ? `\n\n📝 EDITORIAL NOTE: ${mainNote}` : ''}

🔍 CRITICAL: Find exactly 5-7 different reputable source URLs for this story.

Provide:
- Key facts, statistics, dates, and verified claims
- Quotes from key people or organizations
- Context and background (why this matters)
- 5-7 DIFFERENT reputable source URLs (primary sources, major news outlets, company blogs)
- Any verification concerns

Requirements:
- Find 5-7 unique, working URLs from different outlets
- Focus on recent sources (last 7 days preferred)
- Include canonical URLs without tracking parameters
- Prefer primary sources (official announcements, company blogs) when available`,
    });

    // Secondary story research - escape all dynamic content
    if (content.secondaryStory) {
      const secondaryTitle = escapeForTemplateLiteral(content.secondaryStory.title);
      const secondaryUrl = escapeForTemplateLiteral(content.secondaryStory.url);
      const secondaryNote = escapeForTemplateLiteral(content.secondaryStory.note);

      researchPrompts.push({
        category: "Secondary Story",
        prompt: `Research this AI news story: "${secondaryTitle}"${secondaryUrl ? `\nOriginal source: ${secondaryUrl}` : ''}${secondaryNote ? `\n\n📝 EDITORIAL NOTE: ${secondaryNote}` : ''}

🔍 CRITICAL: Find exactly 5-7 different reputable source URLs for this story.

Provide:
- Key facts and verified claims
- Important quotes
- Context and significance
- 5-7 DIFFERENT reputable source URLs from various outlets

Requirements:
- Find 5-7 unique, working URLs
- Focus on recent sources
- Include clean URLs without tracking parameters`,
      });
    }

    // Weekly Scoop research - escape all dynamic content
    if (content.quickLinks && content.quickLinks.length > 0) {
      // Research provided quick links - get exactly 1 URL per story
      content.quickLinks.forEach((link, i) => {
        const linkTitle = escapeForTemplateLiteral(link.title);
        const linkUrl = escapeForTemplateLiteral(link.url);
        const linkNote = escapeForTemplateLiteral(link.note);

        researchPrompts.push({
          category: `Weekly Scoop #${i + 1}`,
          prompt: `Research this AI news item: "${linkTitle}"${linkUrl ? `\nSource: ${linkUrl}` : ''}${linkNote ? `\n\n📝 EDITORIAL NOTE: ${linkNote}` : ''}

🔍 CRITICAL: Find exactly 1 working source URL for this story.

Provide:
- Brief summary (2-3 sentences) with key facts
- Exactly 1 reputable source URL (prefer the original article)`,
        });
      });
    } else {
      // Find 6 diverse AI stories for Weekly Scoop - 1 URL each
      researchPrompts.push({
        category: "Weekly Scoop",
        prompt: `Find 6 diverse, newsworthy AI stories from the past week.

🔍 CRITICAL: For EACH of the 6 stories, provide exactly 1 working source URL.

For each story provide:
- Brief headline
- 1-2 sentence summary
- Exactly 1 source URL from a reputable outlet

Cover different topics: regulations, product launches, research, company news, controversies, etc.
Total: 6 stories = 6 URLs`,
      });
    }

    // Weekly Challenge research - escape all dynamic content
    if (content.challenge) {
      const challengeTitle = escapeForTemplateLiteral(content.challenge.title);
      const challengeDescription = escapeForTemplateLiteral(content.challenge.description);

      researchPrompts.push({
        category: "Weekly Challenge",
        prompt: `Find 1-2 helpful links for this weekly challenge: "${challengeTitle}"${challengeDescription ? `\nDescription: ${challengeDescription}` : ''}

Find ONLY:
- A direct link to the main AI tool mentioned in the challenge
- Optionally, one short tutorial or video showing how to use it

Keep it minimal — just 1-2 links max. Our readers don't want a research paper, just a quick way to get started.`,
      });
    }

    // Research all stories using Perplexity
    log(`[Writer] Researching ${researchPrompts.length} topics with Perplexity...`, "agent");
    const results = await Promise.all(
      researchPrompts.map(({ category, prompt }) =>
        perplexityService.research(prompt).then(result => ({ category, ...result }))
      )
    );

    // Research tweets and YouTube videos for main and secondary stories
    // Jumble: max 2 media total per story (tweets + videos combined)
    // Overclocked: 1 YouTube OR 1 Tweet per story (prefer YouTube)
    // We fetch extras so the writer prompt can pick the best ones
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

    // Build media sections with type-specific limits
    const mediaLimitNote = newsletterType === "overclocked"
      ? `⚠️ MEDIA LIMIT: Each story gets ONE YouTube video OR ONE tweet (not both). Prefer YouTube videos — they look better and get more clicks. Only use a tweet if there is no good YouTube video.`
      : `⚠️ MEDIA LIMIT: Each story gets a MAXIMUM of 2 media embeds total (tweets + YouTube videos combined). Example: 1 YouTube + 1 tweet, or 2 YouTube videos.`;

    const tweetQualityNote = `⚠️ TWEET QUALITY: Only embed tweets that add NEW information, insider perspective, or show something interesting. Do NOT embed tweets that simply announce or restate the news story.`;

    const mediaSections = `
---
# TWEET & VIDEO BANK
${mediaLimitNote}
${tweetQualityNote}

**Main Story Tweets:**
${tweetsByCategory["Main Story"]?.join('\n') || '- (No tweets found)'}

**Main Story YouTube:**
${videosByCategory["Main Story"]?.join('\n') || '- (No videos found)'}

**Secondary Story Tweets:**
${tweetsByCategory["Secondary Story"]?.join('\n') || '- (No tweets found)'}

**Secondary Story YouTube:**
${videosByCategory["Secondary Story"]?.join('\n') || '- (No videos found)'}
---`;

    // Build research document with URL bank (using full Perplexity output)
    const researchSections: string[] = [];
    const urlsByCategory: { [key: string]: string[] } = {
      "Main Story": [],
      "Secondary Story": [],
      "Weekly Scoop": [],
      "Weekly Challenge": [],
    };

    results.forEach(({ category, answer, citations }) => {
      researchSections.push(`\n## ${category}\n\n${answer}\n`);

      // Categorize URLs
      if (category === "Main Story") {
        urlsByCategory["Main Story"].push(...citations);
      } else if (category === "Secondary Story") {
        urlsByCategory["Secondary Story"].push(...citations);
      } else if (category.startsWith("Weekly Scoop")) {
        urlsByCategory["Weekly Scoop"].push(...citations);
      } else if (category === "Weekly Challenge") {
        urlsByCategory["Weekly Challenge"].push(...citations);
      }
    });

    // Build URL bank
    const urlBank = `
---
# VERIFIED URL BANK
⚠️ These URLs come from Perplexity research and are verified to work.
The writer must ONLY use URLs from this list.

**Main Story URLs:**
${urlsByCategory["Main Story"].map(url => `- ${url}`).join('\n') || '- (No URLs found)'}

**Secondary Story URLs:**
${urlsByCategory["Secondary Story"].map(url => `- ${url}`).join('\n') || '- (No URLs found)'}

**Weekly Scoop URLs:**
${urlsByCategory["Weekly Scoop"].map(url => `- ${url}`).join('\n') || '- (No URLs found)'}

**Weekly Challenge URLs:**
${urlsByCategory["Weekly Challenge"].map(url => `- ${url}`).join('\n') || '- (No URLs found)'}
---`;

    const fullResearch = researchSections.join('\n') + '\n' + urlBank + '\n' + mediaSections;

    const totalResearchWords = fullResearch.split(/\s+/).length;
    log(`[Writer] Research complete. Found ${results.reduce((sum, r) => sum + r.citations.length, 0)} verified URLs`, "agent");
    log(`[Writer] Total research length: ${totalResearchWords} words (~${Math.ceil(totalResearchWords * 1.3)} tokens)`, "agent");

    return fullResearch;
  }

  /**
   * Check if the newsletter draft is complete (has all required sections)
   * Note: We no longer check for labeled sections like "Subject Line:" since
   * we told the AI to output content without labels. Instead we check for
   * structural elements that should be present.
   */
  private isNewsletterComplete(draft: string, type: NewsletterType): { complete: boolean; missing: string[] } {
    const missing: string[] = [];

    if (type === "jumble") {
      // Check for Welcome section (should contain "Welcome to Jumble" or similar)
      if (!/Welcome to Jumble|Welcome to this week/i.test(draft)) {
        missing.push('Welcome section');
      }

      // Check for "In this newsletter" bullet list (handle curly apostrophes)
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

    // Check for proper ending (not cut off mid-sentence)
    const trimmed = draft.trim();
    const endsWithPunctuation = /[.!?)\]":]$/.test(trimmed) || trimmed.endsWith('---');
    if (!endsWithPunctuation) missing.push('Proper ending (content appears cut off)');

    return { complete: missing.length === 0, missing };
  }

  /**
   * Validate Weekly Scoop section has embedded URLs
   */
  private validateWeeklyScoop(draft: string): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    // Find Weekly Scoop section
    const scoopMatch = draft.match(/Weekly Scoop[^\n]*\n([\s\S]*?)(?=\n##?\s+Weekly Challenge|$)/i);
    if (!scoopMatch) {
      issues.push('Weekly Scoop section not found');
      return { valid: false, issues };
    }

    const scoopContent = scoopMatch[1];

    // Count emoji lines (headlines)
    const emojiLines = scoopContent.match(/^[^\n]*[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}][^\n]*/gmu) || [];

    if (emojiLines.length < 6) {
      issues.push(`Only ${emojiLines.length} headlines found (need 6)`);
    }

    // Check each line has an embedded URL [text](url)
    let linesWithUrls = 0;
    for (const line of emojiLines) {
      if (/\[([^\]]+)\]\(https?:\/\/[^)]+\)/.test(line)) {
        linesWithUrls++;
      }
    }

    if (linesWithUrls < emojiLines.length) {
      issues.push(`Only ${linesWithUrls}/${emojiLines.length} headlines have embedded URLs (all must have [text](url) format)`);
    }

    return { valid: issues.length === 0, issues };
  }

  /**
   * Validate that main and secondary stories have embedded URLs
   * Stories should have 5-7 embedded links each
   */
  private validateStoryLinks(draft: string, type: NewsletterType): { valid: boolean; issues: string[] } {
    const issues: string[] = [];
    const minLinks = type === "overclocked" ? 2 : 3;

    // Find all H1 headers
    const h1Headers = Array.from(draft.matchAll(/^#\s+[^\n]+$/gm));
    if (h1Headers.length < 2) {
      return { valid: true, issues }; // Can't validate if stories not found
    }

    // Extract main story (first H1 to second H1)
    const firstH1Index = h1Headers[0].index!;
    const secondH1Index = h1Headers[1].index!;
    const mainStory = draft.substring(firstH1Index, secondH1Index);

    // Count embedded links in main story [text](url)
    const mainLinks = (mainStory.match(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/g) || []).length;
    if (mainLinks < minLinks) {
      issues.push(`Main story has only ${mainLinks} embedded links (need at least ${minLinks})`);
    }

    // Extract secondary story (second H1 to Weekly Scoop or end)
    const weeklyScoopMatch = draft.match(/##?\s+Weekly Scoop/i);
    const weeklyScoopIndex = weeklyScoopMatch ? draft.indexOf(weeklyScoopMatch[0]) : draft.length;
    const secondaryStory = draft.substring(secondH1Index, weeklyScoopIndex);

    // Count embedded links in secondary story
    const secondaryLinks = (secondaryStory.match(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/g) || []).length;
    if (secondaryLinks < minLinks) {
      issues.push(`Secondary story has only ${secondaryLinks} embedded links (need at least ${minLinks})`);
    }

    return { valid: issues.length === 0, issues };
  }

  /**
   * Build the correct writing prompt based on newsletter type
   */
  private buildWritePrompt(research: string, issueNumber: number, type: NewsletterType): string {
    const rules = getStyleGuideRules(type);
    const limits = WORD_LIMITS[type];

    if (type === "overclocked") {
      return this.buildOverclockedPrompt(research, issueNumber, rules, limits);
    }
    return this.buildJumblePrompt(research, issueNumber, rules, limits);
  }

  /**
   * Build writing prompt for Jumble newsletter format
   */
  private buildJumblePrompt(research: string, issueNumber: number, rules: string, limits: { min: number; max: number; target: number }): string {
    return `You are the writer for Hello Jumble, a newsletter about AI news. You are generating Issue #${issueNumber}.

# RESEARCH NOTES:

${research}

# CRITICAL STYLE GUIDE - YOU MUST FOLLOW THESE RULES:

${rules}

# YOUR TASK:

Write the COMPLETE newsletter following the structure and rules defined in the STYLE GUIDE section above.
Use the research notes to craft engaging, fact-checked content.

🚨 CRITICAL: You MUST generate ALL sections below. DO NOT stop after the main story or secondary story. KEEP GENERATING until you reach the Sources section at the very end.

# REQUIRED COMPLETE STRUCTURE - YOU MUST INCLUDE ALL OF THESE SECTIONS IN ORDER:

🚨 CRITICAL: Do NOT include section numbers or labels like "Section 1:", "Section 2:", etc. in your output.
The sections below are numbered for YOUR reference only - do NOT output these numbers.

1. **Subject Line** (40-60 characters) - Output ONLY the subject line text, no label. Use emotional or provocative framing, NOT informational summaries. Aim for "wait, what?" reactions.
2. **Preview Text** (Tease secondary story + one Weekly Scoop item) - Output ONLY the preview text, no label
3. **Newsletter Title** (≤60 characters, fresh angle on main story) - Output ONLY the title text, no label
4. **Welcome To This Week's Edition Of Jumble** (45-70 words, end with ⬇️) - Start with "Welcome to Jumble..."
5. **In this newsletter:** (Exactly 5 bullets with emojis) - CRITICAL: Each bullet MUST be on its own line
   - Output "In this newsletter:" on one line
   - Then output 5 separate lines, each starting with an emoji
   - Format: emoji + space + description (one per line)
6. **Main Story** - MUST be a separate H1 header with emoji (e.g., "# 🤖 Your Story Title")
  - ~${limits.target} words with 2-3 H2 subsections with emojis
  - 🔗 MUST embed 5-7 different URLs from Main Story URL bank throughout the story
  - Max 2 media embeds total (tweets + YouTube combined). Example: 1 YouTube + 1 tweet
  - Only embed tweets that add NEW info beyond the story. Skip tweets that just announce the news.
  - YouTube videos: 🎬 [Title](url)
  - Tweets: > "tweet text" — [@handle](url)
  - Include 1 poll (question + 2-3 options as bullet list). This should be the ONLY poll in the newsletter unless the secondary story has a better one.
  - Poll must be something people are heavily opinionated about: personal behavior, moral/ethical debate, fear/concern, or interactive challenge.
  - Good polls: "Do you say please and thank you to AI?", "Is this a good idea?", "Have you tried X yet?", "Are we replacing too many jobs?"
7. **Secondary Story** - MUST be a separate H1 header with emoji (NOT nested under main story)
  - ~${limits.target} words with 1-3 H2 subsections with emojis
  - 🔗 MUST embed 5-7 different URLs from Secondary Story URL bank throughout the story
  - Max 2 media embeds total (tweets + YouTube combined). Only embed tweets that add NEW info.
  - NO poll in the secondary story (the main story already has one), UNLESS the secondary story has a much more compelling poll question — in which case, move the poll here and skip it in the main story.
8. **Weekly Scoop 📢** - Output as "## Weekly Scoop 📢" followed by 6 headlines
  - Each headline: emoji + [markdown link](url)
  - 🔗 Each headline MUST have exactly 1 embedded URL from Weekly Scoop URL bank
9. **Weekly Challenge** (125-175 words) - Output as "## Weekly Challenge" followed by:
  - Fun, casual intro (1-2 sentences) that makes readers WANT to try it
  - 3-5 simple steps, each with a unique emoji prefix
  - Tone: like a friend explaining something cool, NOT a technical manual
  - Use only 1-2 AI tools per challenge (keep it simple)
  - Include 1-2 links max (direct link to the tool, optionally a tutorial)
  - Challenges should be fun, surprising, or genuinely useful for everyday life
  - Our readers are NOT coders — they're curious people who love trying new things
  - Format each step as: "🎁 Step 1: [Title]" followed by 1-2 sentences
  - Example format:
    🎨 Step 1: Grab your worst photo
    Find that blurry vacation pic you almost deleted...

    ✨ Step 2: Let AI work its magic
    Head to [tool name](link) and upload it...
10. **Wrap Up** (Bold 1-2 lines inviting replies) - Output as "## Wrap Up" followed by content
11. **Sources** - Output as "## Sources" with URLs grouped by category

⚠️ CRITICAL COMPLETION REQUIREMENTS:
1. You MUST complete ALL 11 sections above - no exceptions
2. Do NOT include "Section 1:", "Section 2:", etc. in your output - output the content directly
3. The Main Story and Secondary Story MUST have separate H1 headers (# Header)
4. The newsletter is NOT complete until you write the Sources section
5. Keep it tight - hit the word count targets per section, don't pad

📋 OUTPUT FORMAT EXAMPLE (showing correct structure WITHOUT section labels):
\`\`\`
The Subject Line Goes Here

Preview text goes here...

Why This Matters: The Main Story Angle

Welcome to Jumble, your go-to source for AI news updates...

In this newsletter:
🤖 First bullet point
💡 Second bullet point
...

# 🤖 Main Story H1 Title Here

First paragraph of main story...

> "Notable tweet about the story" — [@expert](https://x.com/expert/status/123)

## 🔍 First H2 Subsection

Content with [embedded links](https://url.com)...

🎬 [Relevant Video Title](https://youtube.com/watch?v=abc)

Should AI companies prioritize safety over speed?
- Yes, safety first
- No, innovation matters more
- It depends on the context

# 💡 Secondary Story H1 Title Here

Secondary story content...

## Weekly Scoop 📢

🍎 [First headline as markdown link](https://url1.com)
🚀 [Second headline as markdown link](https://url2.com)
...

## Weekly Challenge

Ever wondered what you'd look like as a Pixar character? This week, we're finding out.

🎨 Step 1: Find your best selfie
Grab a photo where your face is clearly visible — silly faces welcome.

✨ Step 2: Head to the AI
Open [tool name](link) and upload your photo.

🎶 Step 3: Connect the AI
Add a step to send content to ChatGPT or Claude with a simple prompt.

📸 Step 4: Define the output
Tell the tool where to send the result: Slack, email, or notes app.

## Wrap Up

Wrap up content...

## Sources

**Main Story:**
- https://url1.com
...
\`\`\`

# 🚨 CRITICAL URL EMBEDDING RULES - READ CAREFULLY:

## URL Usage Requirements:
1. **ONLY USE URLs FROM THE "VERIFIED URL BANK" SECTION** in the research notes above
2. **COPY URLs EXACTLY** character-for-character - do NOT modify, shorten, or recreate them
3. **DO NOT INVENT OR HALLUCINATE URLs** - if you need a URL, it MUST be in the URL bank
4. **NO PLACEHOLDERS** - do not use example.com or any fake URLs

## Link Embedding Requirements:

**Main Story (Section 6):**
- MUST embed 5-7 DIFFERENT URLs from "Main Story URLs" section of URL bank
- Embed URLs over natural anchor text (3-9 words)
- Example: "According to [the company's official announcement](https://actual-url.com), the new feature..."
- Spread links throughout the story (intro paragraph, H2 subsections)

**Secondary Story (Section 7):**
- MUST embed 5-7 DIFFERENT URLs from "Secondary Story URLs" section of URL bank
- Same embedding format as main story
- Use different URLs for different claims

**Weekly Scoop (Section 8):**
🚨 CRITICAL FORMAT - EVERY HEADLINE MUST BE A MARKDOWN LINK:
- CORRECT: 🤖 [Headline text that describes the story](https://actual-url.com)
- WRONG: 🤖 Headline text that describes the story (NO URL = INVALID)
- Each of the 6 headlines MUST have exactly 1 embedded URL from "Weekly Scoop URLs"
- The ENTIRE headline text must be inside [square brackets] with (url) immediately after
- Use ALL 6 URLs from the Weekly Scoop URL bank - each URL used exactly once
- ⚠️ Write ORIGINAL headlines in your own words. Do NOT copy verbatim from sources
- NO plain text headlines - every single one MUST be [clickable](url)

## Tweet and Video Embedding:
- Embed tweets EXACTLY as provided in the TWEET & VIDEO BANK
- Embed YouTube videos EXACTLY as provided in the TWEET & VIDEO BANK
- Use the format: > "tweet text" — [@handle](url) for tweets
- Use the format: 🎬 [Video Title](url) for YouTube videos

## Sources Section (Section 11):
After the Wrap Up section, add:

---
## Sources

**Main Story:**
- URL 1
- URL 2
- URL 3
...

**Secondary Story:**
- URL 1
- URL 2
...

**Weekly Scoop:**
- URL 1
- URL 2
...
---

⚠️ List ONLY the URLs you actually used in the newsletter, grouped by section.

Ensure all word counts, formatting rules, and link standards are strictly followed.

🚨 BEFORE YOU FINISH - COMPLETION CHECKLIST:

Before ending your output, verify you have written ALL of these sections:
✓ Subject Line (just the text, NO "Section 1:" label)
✓ Preview Text (just the text, NO "Section 2:" label)
✓ Newsletter Title (just the text, NO "Section 3:" label)
✓ Welcome message (starts with "Welcome to Jumble...")
✓ "In this newsletter:" bullets (5 bullets with emojis, EACH ON A SEPARATE LINE)
✓ Main Story (separate H1 like "# 🤖 Title", ~${limits.target} words, with 5-7 embedded links, max 2 media embeds, 1 opinionated poll)
✓ Secondary Story (separate H1 like "# 💡 Title", ~${limits.target} words, with 5-7 embedded links, max 2 media embeds, NO poll unless it's better than the main story's)
✓ Weekly Scoop - VERIFY EACH OF THE 6 HEADLINES IS A MARKDOWN LINK:
  - ✅ 🤖 [Headline text](https://url.com) = CORRECT
  - ❌ 🤖 Headline text = WRONG (missing URL)
✓ Weekly Challenge (125-175 words with 3-5 emoji-prefixed steps, 1-2 links max, fun and approachable tone)
✓ Wrap Up
✓ Sources section

If ANY section is missing or Weekly Scoop headlines lack embedded URLs, you have NOT completed the newsletter correctly. Keep writing until ALL sections are present and properly formatted.

CRITICAL OUTPUT INSTRUCTIONS:
1. Do NOT include section labels like "Section 1:", "Section 2:", etc. in your output
2. Do NOT include any internal thought process, reasoning, or conversational text
3. Output ONLY the final newsletter content with sections in the correct order
4. Do NOT stop generating until you have written the Sources section at the very end
5. Wrap the entire output in a markdown code block (\`\`\`markdown ... \`\`\`).`;
  }

  /**
   * Build writing prompt for Overclocked newsletter format
   */
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
   - 2-3 lowercase Q&A sub-headers that are SPECIFIC to the story. Do NOT use generic questions like "what happened?" or "why does this matter?". Instead reference specific details: "....$38 million and he's mad?", "so Canada forced their hand?", "👀 wait, them too?"
   - Embed 3-5 URLs from Main Story URL bank
   - ONE YouTube video OR one tweet (not both). Prefer YouTube — it looks better and gets more clicks. Only use a tweet if no good YouTube video exists.
   - Only embed tweets that add NEW information. Skip tweets that just announce the news.
   - 1 poll: question + 2-3 options. Must be something people are heavily opinionated about (personal behavior, moral debate, fear/concern, interactive challenge).
   - Good polls: "What grade should your child start learning AI?", "Are you worried about AI taking your job?", "Should AI have rights?"
3. **Secondary Story**: same format as main, lowercase headline + emoji at END
   - Italic teaser, ~${limits.target} words
   - Q&A sub-headers must be SPECIFIC to THIS story (not generic)
   - 3-5 URLs, ONE YouTube video OR one tweet (not both, prefer YouTube)
   - NO poll (main story already has one), unless this story has a much more compelling poll question
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

  /**
   * Phase 2: Write newsletter using Gemini Flash Preview with style guide
   * AI crafts the final newsletter following all rules
   * Includes retry logic for truncation and validation
   */
  private async writeNewsletter(research: string, issueNumber: number, newsletterType: NewsletterType): Promise<string> {
    const writePrompt = this.buildWritePrompt(research, issueNumber, newsletterType);

    const MAX_RETRIES = 3;
    let draft = '';
    let attempt = 0;
    let lastIssues: string[] = [];

    while (attempt < MAX_RETRIES) {
      attempt++;
      log(`[Writer] Generation attempt ${attempt}/${MAX_RETRIES}...`, "agent");

      const result = await geminiService.generateWithProDetailed(writePrompt, {
        temperature: 0.6 + (attempt - 1) * 0.1, // Slightly increase temp on retries
        maxTokens: 65536,
      });

      draft = result.text;
      const rawDraftLength = draft.length;
      const rawWordCount = draft.split(/\s+/).length;
      log(`[Writer] Raw draft from Gemini: ${rawDraftLength} chars (${rawWordCount} words), finish: ${result.finishReason}`, "agent");

      // Extract markdown from code block if present
      const match = draft.match(/```markdown\n([\s\S]*?)\n?```/);
      if (match) {
        draft = match[1];
        log(`[Writer] Extracted from markdown code block`, "agent");
      } else {
        // Fallback: strip any leading conversational text
        const possibleStarts = newsletterType === "overclocked"
          ? ["Mon,", "Tue,", "Wed,", "Thu,", "Fri,", "Sat,", "Sun,"]
          : ["Subject Line", "Welcome to Jumble", "# "];
        let earliestStart = -1;

        for (const start of possibleStarts) {
          const index = draft.indexOf(start);
          if (index !== -1 && (earliestStart === -1 || index < earliestStart)) {
            earliestStart = index;
          }
        }

        if (earliestStart > 0) {
          draft = draft.substring(earliestStart);
          log(`[Writer] Stripped leading text, started at position ${earliestStart}`, "agent");
        }
      }

      // Validate completeness
      const completionCheck = this.isNewsletterComplete(draft, newsletterType);
      const scoopCheck = this.validateWeeklyScoop(draft);
      const storyLinksCheck = this.validateStoryLinks(draft, newsletterType);
      lastIssues = [...completionCheck.missing, ...scoopCheck.issues, ...storyLinksCheck.issues];

      if (completionCheck.complete && scoopCheck.valid && storyLinksCheck.valid) {
        log(`[Writer] ✅ Newsletter validation passed on attempt ${attempt}`, "agent");
        break;
      }

      // Log issues
      if (result.wasTruncated) {
        log(`[Writer] ⚠️ Output was truncated (MAX_TOKENS). Retrying...`, "agent");
      }
      if (completionCheck.missing.length > 0) {
        log(`[Writer] ⚠️ Missing sections: ${completionCheck.missing.join(', ')}`, "agent");
      }
      if (scoopCheck.issues.length > 0) {
        log(`[Writer] ⚠️ Weekly Scoop issues: ${scoopCheck.issues.join(', ')}`, "agent");
      }
      if (storyLinksCheck.issues.length > 0) {
        log(`[Writer] ⚠️ Story link issues: ${storyLinksCheck.issues.join(', ')}`, "agent");
      }

      if (attempt < MAX_RETRIES) {
        log(`[Writer] Retrying generation...`, "agent");
      }
    }

    // Final warning if still incomplete after all retries
    if (lastIssues.length > 0) {
      log(`[Writer] ⚠️ WARNING: After ${MAX_RETRIES} attempts, still has issues: ${lastIssues.join(', ')}`, "agent");
    }

    log(`[Writer] Final extracted draft: ${draft.length} chars (${draft.split(/\s+/).length} words)`, "agent");

    return draft;
  }

  /**
   * Phase 3: Validate word counts for main and secondary stories
   * Ensures both stories are within the configured WORD_LIMITS range per newsletter type
   * Auto-fixes if out of range while preserving all embedded links
   */
  private async validateAndFixWordCounts(draft: string, type: NewsletterType): Promise<string> {
    // Extract main and secondary story sections
    const sections = this.extractStorySections(draft);
    const limits = WORD_LIMITS[type];

    log(`[Writer] Extracted sections - Main: ${sections.mainStory ? 'YES' : 'NO'}, Secondary: ${sections.secondaryStory ? 'YES' : 'NO'}`, "agent");

    if (!sections.mainStory && !sections.secondaryStory) {
      log("[Writer] Could not extract story sections for word count validation", "agent");
      return draft; // Return as-is if extraction fails
    }

    let updatedDraft = draft;
    let needsRewrite = false;

    // Check main story word count
    if (sections.mainStory) {
      const mainWordCount = this.countWords(sections.mainStory.content);
      log(`[Writer] Main story word count: ${mainWordCount}`, "agent");

      // Only rewrite if word count is reasonable (not suspiciously low like 12 words)
      if (mainWordCount < Math.min(50, limits.min)) {
        log(`[Writer] ⚠️ Main story word count suspiciously low (${mainWordCount}). Skipping rewrite to avoid errors.`, "agent");
        log(`[Writer] Main story content length: ${sections.mainStory.content.length} chars`, "agent");
      } else if (mainWordCount < limits.min || mainWordCount > limits.max) {
        log(`[Writer] Main story out of range (${limits.min}-${limits.max}). Rewriting to ${limits.target} words...`, "agent");
        const rewritten = await this.rewriteToWordCount(sections.mainStory.content, limits.target);
        updatedDraft = updatedDraft.replace(sections.mainStory.content, rewritten);
        needsRewrite = true;
      }
    }

    // Check secondary story word count
    if (sections.secondaryStory) {
      const secondaryWordCount = this.countWords(sections.secondaryStory.content);
      log(`[Writer] Secondary story word count: ${secondaryWordCount}`, "agent");

      // Only rewrite if word count is reasonable (not suspiciously low)
      if (secondaryWordCount < Math.min(50, limits.min)) {
        log(`[Writer] ⚠️ Secondary story word count suspiciously low (${secondaryWordCount}). Skipping rewrite to avoid errors.`, "agent");
        log(`[Writer] Secondary story content length: ${sections.secondaryStory.content.length} chars`, "agent");
      } else if (secondaryWordCount < limits.min || secondaryWordCount > limits.max) {
        log(`[Writer] Secondary story out of range (${limits.min}-${limits.max}). Rewriting to ${limits.target} words...`, "agent");
        const rewritten = await this.rewriteToWordCount(sections.secondaryStory.content, limits.target);
        updatedDraft = updatedDraft.replace(sections.secondaryStory.content, rewritten);
        needsRewrite = true;
      }
    }

    if (needsRewrite) {
      log("[Writer] Word count validation complete. Stories rewritten.", "agent");
    } else {
      log("[Writer] Word count validation complete. All stories within range.", "agent");
    }

    return updatedDraft;
  }

  /**
   * Extract main and secondary story sections from the draft
   * Returns content from H1 header through all subsections until next major section
   */
  private extractStorySections(draft: string): {
    mainStory: { content: string } | null;
    secondaryStory: { content: string } | null;
  } {
    // Find all H1 headers (lines starting with # followed by space)
    const h1Headers = Array.from(draft.matchAll(/^#\s+[^\n]+$/gm));

    log(`[Writer] Found ${h1Headers.length} H1 headers in draft`, "agent");

    if (h1Headers.length === 0) {
      log("[Writer] ⚠️ No H1 headers found - cannot extract stories", "agent");
      return { mainStory: null, secondaryStory: null };
    }

    // Log the H1 headers found
    h1Headers.forEach((match, i) => {
      log(`[Writer] H1 ${i + 1}: "${match[0]}" at index ${match.index}`, "agent");
    });

    let mainStory = null;
    let secondaryStory = null;

    // Find Weekly Scoop marker (could be H2 or text)
    const weeklyScoopMatch = draft.match(/^##?\s+Weekly Scoop/gm);
    const weeklyScoopIndex = weeklyScoopMatch ? draft.indexOf(weeklyScoopMatch[0]) : -1;

    log(`[Writer] Weekly Scoop found at index: ${weeklyScoopIndex}`, "agent");

    if (h1Headers.length >= 1) {
      // Main story: from first H1 to second H1 (or Weekly Scoop if no second H1)
      const firstH1Index = h1Headers[0].index!;
      const secondH1Index = h1Headers.length > 1 ? h1Headers[1].index! : -1;

      let mainEndIndex: number;
      if (secondH1Index !== -1) {
        mainEndIndex = secondH1Index;
      } else if (weeklyScoopIndex !== -1) {
        mainEndIndex = weeklyScoopIndex;
      } else {
        mainEndIndex = draft.length;
      }

      mainStory = {
        content: draft.substring(firstH1Index, mainEndIndex).trim()
      };

      const mainWordCount = this.countWords(mainStory.content);
      log(`[Writer] Extracted main story: ${mainStory.content.length} chars, ${mainWordCount} words`, "agent");
      log(`[Writer] Main story preview: ${mainStory.content.substring(0, 200)}...`, "agent");

      // Secondary story: from second H1 to Weekly Scoop (if exists)
      if (h1Headers.length >= 2) {
        let secondaryEndIndex: number;
        if (weeklyScoopIndex !== -1) {
          secondaryEndIndex = weeklyScoopIndex;
        } else {
          secondaryEndIndex = draft.length;
        }

        secondaryStory = {
          content: draft.substring(secondH1Index, secondaryEndIndex).trim()
        };

        const secondaryWordCount = this.countWords(secondaryStory.content);
        log(`[Writer] Extracted secondary story: ${secondaryStory.content.length} chars, ${secondaryWordCount} words`, "agent");
        log(`[Writer] Secondary story preview: ${secondaryStory.content.substring(0, 200)}...`, "agent");
      } else {
        log("[Writer] ⚠️ No second H1 found - no secondary story extracted", "agent");
      }
    }

    return { mainStory, secondaryStory };
  }

  /**
   * Count words in a text section (excluding markdown syntax)
   */
  private countWords(text: string): number {
    // Remove markdown headers (# symbols)
    let cleaned = text.replace(/^#+\s+/gm, '');

    // Remove markdown links but keep anchor text: [text](url) -> text
    cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

    // Remove emojis
    cleaned = cleaned.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');

    // Split by whitespace and count
    const words = cleaned.trim().split(/\s+/).filter(w => w.length > 0);
    return words.length;
  }

  /**
   * Rewrite a story section to hit exact word count while preserving all links
   */
  private async rewriteToWordCount(section: string, targetWords: number): Promise<string> {
    const currentWords = this.countWords(section);

    const rewritePrompt = `You are rewriting a newsletter story section to meet an exact word count requirement.

ORIGINAL SECTION (${currentWords} words):
${section}

TARGET: Exactly ${targetWords} words

CRITICAL REQUIREMENTS:
1. **PRESERVE ALL EMBEDDED LINKS EXACTLY** - Do not modify, remove, or add any [anchor text](url) links
2. **Keep the same anchor text** - Only adjust surrounding content, not the linked text
3. **Maintain all H2 subsection headers** with emojis
4. **Keep the same structure and flow**
5. Adjust ONLY the non-link content to ${currentWords < targetWords ? 'expand' : 'condense'} to exactly ${targetWords} words

${currentWords < targetWords
  ? 'Add more context, details, or examples to reach the word count.'
  : 'Condense by removing redundancy while keeping key information.'}

Output ONLY the rewritten section with no explanations or conversational text.`;

    const result = await geminiService.generateWithProDetailed(rewritePrompt, {
      temperature: 0.4, // Lower temp for precision
      maxTokens: 32768, // Increased to avoid truncation
    });

    // If the rewrite was truncated, keep the original to avoid corrupted content
    if (result.wasTruncated) {
      log(`[Writer] ⚠️ Rewrite was truncated, keeping original section (${currentWords} words)`, "agent");
      return section;
    }

    return result.text.trim();
  }

}

// Singleton instance
export const writerAgent = new WriterAgent();
