import { geminiService } from "../services/gemini";
import { perplexityService } from "../services/perplexity";
import { NewsletterStyleGuide } from "../config/style-guide";
import { log } from "../index";

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
 * 3. Phase 3 (Auto Word Count Fix): Validate 325-450 words, rewrite if needed (preserves links)
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
  async generateNewsletter(content: SimpleIssueContent, issueNumber: number): Promise<string> {
    log("[Writer] Starting simplified three-phase generation...", "agent");

    try {
      // Phase 1: Research and fact-check using Perplexity (verified URLs)
      log("[Writer Phase 1] Researching and fact-checking stories with Perplexity...", "agent");
      const research = await this.researchStories(content);

      // Phase 2: Write newsletter using Gemini Flash Preview
      log("[Writer Phase 2] Writing newsletter...", "agent");
      let draft = await this.writeNewsletter(research, issueNumber);

      // Phase 3: Validate and fix word counts (325-450 words per story)
      log("[Writer Phase 3] Validating word counts...", "agent");
      draft = await this.validateAndFixWordCounts(draft);

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
  private async researchStories(content: SimpleIssueContent): Promise<string> {
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
        prompt: `Find resources for this weekly challenge: "${challengeTitle}"${challengeDescription ? `\nDescription: ${challengeDescription}` : ''}

Find:
- Tutorial links (especially YouTube videos)
- Step-by-step guides
- Relevant tools or platforms
- Example use cases

Provide working URLs to reputable resources.`,
      });
    }

    // Research all stories using Perplexity
    log(`[Writer] Researching ${researchPrompts.length} topics with Perplexity...`, "agent");
    const results = await Promise.all(
      researchPrompts.map(({ category, prompt }) =>
        perplexityService.research(prompt).then(result => ({ category, ...result }))
      )
    );

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

    const fullResearch = researchSections.join('\n') + '\n' + urlBank;

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
  private isNewsletterComplete(draft: string): { complete: boolean; missing: string[] } {
    const missing: string[] = [];

    // Check for Welcome section (should contain "Welcome to Jumble" or similar)
    if (!/Welcome to Jumble|Welcome to this week/i.test(draft)) {
      missing.push('Welcome section');
    }

    // Check for "In this newsletter" bullet list (handle curly apostrophes)
    if (!/In this newsletter|In today.s newsletter/i.test(draft)) {
      missing.push('In this newsletter bullets');
    }

    // Check for at least 2 H1 headers (main and secondary stories)
    const h1Count = (draft.match(/^#\s+[^\n]+/gm) || []).length;
    if (h1Count < 2) {
      missing.push(`Story H1 headers (found ${h1Count}, need 2)`);
    }

    // Check for Weekly Scoop section
    if (!/Weekly Scoop/i.test(draft)) {
      missing.push('Weekly Scoop');
    }

    // Check for Weekly Challenge section
    if (!/Weekly Challenge|Challenge:/i.test(draft)) {
      missing.push('Weekly Challenge');
    }

    // Check for Wrap Up section
    if (!/Wrap Up|wrap.up/i.test(draft)) {
      missing.push('Wrap Up');
    }

    // Check for Sources section
    if (!/##?\s*Sources/i.test(draft)) {
      missing.push('Sources');
    }

    // Check for proper ending (not cut off mid-sentence)
    const trimmed = draft.trim();
    const endsWithPunctuation = /[.!?)\]":]$/.test(trimmed) || trimmed.endsWith('---');
    if (!endsWithPunctuation) {
      missing.push('Proper ending (content appears cut off)');
    }

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
  private validateStoryLinks(draft: string): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

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
    if (mainLinks < 3) {
      issues.push(`Main story has only ${mainLinks} embedded links (need at least 5-7)`);
    }

    // Extract secondary story (second H1 to Weekly Scoop or end)
    const weeklyScoopMatch = draft.match(/##?\s+Weekly Scoop/i);
    const weeklyScoopIndex = weeklyScoopMatch ? draft.indexOf(weeklyScoopMatch[0]) : draft.length;
    const secondaryStory = draft.substring(secondH1Index, weeklyScoopIndex);

    // Count embedded links in secondary story
    const secondaryLinks = (secondaryStory.match(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/g) || []).length;
    if (secondaryLinks < 3) {
      issues.push(`Secondary story has only ${secondaryLinks} embedded links (need at least 5-7)`);
    }

    return { valid: issues.length === 0, issues };
  }

  /**
   * Phase 2: Write newsletter using Gemini Flash Preview with style guide
   * AI crafts the final newsletter following all rules
   * Includes retry logic for truncation and validation
   */
  private async writeNewsletter(research: string, issueNumber: number): Promise<string> {
    const writePrompt = `You are the writer for Hello Jumble, a newsletter about AI news. You are generating Issue #${issueNumber}.

# RESEARCH NOTES:

${research}

# CRITICAL STYLE GUIDE - YOU MUST FOLLOW THESE RULES:

${NewsletterStyleGuide.rules}

# YOUR TASK:

Write the COMPLETE newsletter following the structure and rules defined in the STYLE GUIDE section above.
Use the research notes to craft engaging, fact-checked content.

🚨 CRITICAL: This is a LONG newsletter (~2500+ words). You MUST generate ALL sections below. DO NOT stop after the main story or secondary story. KEEP GENERATING until you reach the Sources section at the very end.

# REQUIRED COMPLETE STRUCTURE - YOU MUST INCLUDE ALL OF THESE SECTIONS IN ORDER:

🚨 CRITICAL: Do NOT include section numbers or labels like "Section 1:", "Section 2:", etc. in your output.
The sections below are numbered for YOUR reference only - do NOT output these numbers.

1. **Subject Line** (40-60 characters) - Output ONLY the subject line text, no label
2. **Preview Text** (Tease secondary story + one Weekly Scoop item) - Output ONLY the preview text, no label
3. **Newsletter Title** (≤60 characters, fresh angle on main story) - Output ONLY the title text, no label
4. **Welcome To This Week's Edition Of Jumble** (45-70 words, end with ⬇️) - Start with "Welcome to Jumble..."
5. **In this newsletter:** (Exactly 5 bullets with emojis) - CRITICAL: Each bullet MUST be on its own line
   - Output "In this newsletter:" on one line
   - Then output 5 separate lines, each starting with an emoji
   - Format: emoji + space + description (one per line)
6. **Main Story** - MUST be a separate H1 header with emoji (e.g., "# 🤖 Your Story Title")
  - ~400 words with 2-3 H2 subsections with emojis
  - 🔗 MUST embed 5-7 different URLs from Main Story URL bank throughout the story
7. **Secondary Story** - MUST be a separate H1 header with emoji (NOT nested under main story)
  - ~350 words with 1-3 H2 subsections with emojis
  - 🔗 MUST embed 5-7 different URLs from Secondary Story URL bank throughout the story
8. **Weekly Scoop 📢** - Output as "## Weekly Scoop 📢" followed by 6 headlines
  - Each headline: emoji + [markdown link](url)
  - 🔗 Each headline MUST have exactly 1 embedded URL from Weekly Scoop URL bank
9. **Weekly Challenge** (200-350 words) - Output as "## Weekly Challenge" followed by:
  - Brief intro explaining the challenge (1-2 sentences)
  - Optional: YouTube video embed if relevant
  - 4-7 numbered steps, each with a unique emoji prefix
  - Use MODERN AI tools ONLY (2025-2026 tools like ChatGPT, Claude 3.5, Gemini 2.0, NotebookLM, Midjourney v6, Perplexity, Gamma, etc.)
  - NO outdated tools or deprecated workflows
  - Format each step as: "🎁 Step 1: [Title]" followed by 1-2 sentences of instructions
  - Example format:
    🎁 Step 1: Pick your constraints
    Give ChatGPT your rules in one message...

    🍪 Step 2: Turn one idea into action
    Have ChatGPT generate two options...

  - CRITICAL: You MUST generate between 4-7 steps (not just 3-4)
10. **Wrap Up** (Bold 1-2 lines inviting replies) - Output as "## Wrap Up" followed by content
11. **Sources** - Output as "## Sources" with URLs grouped by category

⚠️ CRITICAL COMPLETION REQUIREMENTS:
1. You MUST complete ALL 11 sections above - no exceptions
2. Do NOT include "Section 1:", "Section 2:", etc. in your output - output the content directly
3. The Main Story and Secondary Story MUST have separate H1 headers (# Header)
4. The newsletter is NOT complete until you write the Sources section
5. Expected total length: 2500+ words

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

## 🔍 First H2 Subsection

Content with [embedded links](https://url.com)...

# 💡 Secondary Story H1 Title Here

Secondary story content...

## Weekly Scoop 📢

🍎 [First headline as markdown link](https://url1.com)
🚀 [Second headline as markdown link](https://url2.com)
...

## Weekly Challenge

This week, try building your first AI workflow with no-code tools.

🎁 Step 1: Pick your task
Choose one repetitive chore that takes 10 minutes of your day.

🍪 Step 2: Set the trigger
Use Zapier or Make to create a trigger for when new content arrives.

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
✓ Main Story (separate H1 like "# 🤖 Title", ~400 words, with 5-7 embedded links)
✓ Secondary Story (separate H1 like "# 💡 Title", ~350 words, with 5-7 embedded links)
✓ Weekly Scoop - VERIFY EACH OF THE 6 HEADLINES IS A MARKDOWN LINK:
  - ✅ 🤖 [Headline text](https://url.com) = CORRECT
  - ❌ 🤖 Headline text = WRONG (missing URL)
✓ Weekly Challenge (200-350 words with 4-7 emoji-prefixed steps like "🎁 Step 1: Title" using modern AI tools)
✓ Wrap Up
✓ Sources section

If ANY section is missing or Weekly Scoop headlines lack embedded URLs, you have NOT completed the newsletter correctly. Keep writing until ALL sections are present and properly formatted.

CRITICAL OUTPUT INSTRUCTIONS:
1. Do NOT include section labels like "Section 1:", "Section 2:", etc. in your output
2. Do NOT include any internal thought process, reasoning, or conversational text
3. Output ONLY the final newsletter content with sections in the correct order
4. Do NOT stop generating until you have written the Sources section at the very end
5. Wrap the entire output in a markdown code block (\`\`\`markdown ... \`\`\`).`;

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
        const possibleStarts = ["Subject Line", "Welcome to Jumble", "# "];
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
      const completionCheck = this.isNewsletterComplete(draft);
      const scoopCheck = this.validateWeeklyScoop(draft);
      const storyLinksCheck = this.validateStoryLinks(draft);
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
   * Ensures both stories are between 325-450 words (50 word tolerance over 400)
   * Auto-fixes if out of range while preserving all embedded links
   */
  private async validateAndFixWordCounts(draft: string): Promise<string> {
    // Extract main and secondary story sections
    const sections = this.extractStorySections(draft);

    log(`[Writer] Extracted sections - Main: ${sections.mainStory ? 'YES' : 'NO'}, Secondary: ${sections.secondaryStory ? 'YES' : 'NO'}`, "agent");

    if (!sections.mainStory && !sections.secondaryStory) {
      log("[Writer] Could not extract story sections for word count validation", "agent");
      return draft; // Return as-is if extraction fails
    }

    let updatedDraft = draft;
    let needsRewrite = false;

    // Word count limits: 325-450 (50 word tolerance over target of 400)
    const MIN_WORDS = 325;
    const MAX_WORDS = 450;

    // Check main story word count
    if (sections.mainStory) {
      const mainWordCount = this.countWords(sections.mainStory.content);
      log(`[Writer] Main story word count: ${mainWordCount}`, "agent");

      // Only rewrite if word count is reasonable (not suspiciously low like 12 words)
      if (mainWordCount < 100) {
        log(`[Writer] ⚠️ Main story word count suspiciously low (${mainWordCount}). Skipping rewrite to avoid errors.`, "agent");
        log(`[Writer] Main story content length: ${sections.mainStory.content.length} chars`, "agent");
      } else if (mainWordCount < MIN_WORDS || mainWordCount > MAX_WORDS) {
        log(`[Writer] Main story out of range (${MIN_WORDS}-${MAX_WORDS}). Rewriting to 375 words...`, "agent");
        const rewritten = await this.rewriteToWordCount(sections.mainStory.content, 375);
        updatedDraft = updatedDraft.replace(sections.mainStory.content, rewritten);
        needsRewrite = true;
      }
    }

    // Check secondary story word count
    if (sections.secondaryStory) {
      const secondaryWordCount = this.countWords(sections.secondaryStory.content);
      log(`[Writer] Secondary story word count: ${secondaryWordCount}`, "agent");

      // Only rewrite if word count is reasonable (not suspiciously low)
      if (secondaryWordCount < 100) {
        log(`[Writer] ⚠️ Secondary story word count suspiciously low (${secondaryWordCount}). Skipping rewrite to avoid errors.`, "agent");
        log(`[Writer] Secondary story content length: ${sections.secondaryStory.content.length} chars`, "agent");
      } else if (secondaryWordCount < MIN_WORDS || secondaryWordCount > MAX_WORDS) {
        log(`[Writer] Secondary story out of range (${MIN_WORDS}-${MAX_WORDS}). Rewriting to 375 words...`, "agent");
        const rewritten = await this.rewriteToWordCount(sections.secondaryStory.content, 375);
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
