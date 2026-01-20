import { geminiService } from "../services/gemini";
import { perplexityService } from "../services/perplexity";
import { NewsletterStyleGuide } from "../config/style-guide";
import { log } from "../index";

/**
 * Simple story topic - just a title and optional URL
 * AI will research and fact-check using grounded search
 */
export interface StoryTopic {
  title: string;
  url?: string; // Optional - AI can find sources if not provided
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
 * 1. Phase 1 (Perplexity): Research stories with verified URLs and fact-checking
 * 2. Phase 2 (Gemini Flash Preview): Write newsletter following style guide
 *
 * REMOVED:
 * - Pre-fetched story summaries
 * - Separate investigator agent
 * - Separate compliance officer agent
 * - Complex prompt building with embedded content
 * - Gemini grounded search (replaced with Perplexity for better URL accuracy)
 *
 * The AI does what it does best: search, research, and write.
 */
export class WriterAgent {
  /**
   * Generate newsletter from simple story topics
   * AI handles research, fact-checking, and writing
   */
  async generateNewsletter(content: SimpleIssueContent, issueNumber: number): Promise<string> {
    log("[Writer] Starting simplified two-phase generation...", "agent");

    try {
      // Phase 1: Research and fact-check using Perplexity (verified URLs)
      log("[Writer Phase 1] Researching and fact-checking stories with Perplexity...", "agent");
      const research = await this.researchStories(content);

      // Phase 2: Write newsletter using Gemini Flash Preview
      log("[Writer Phase 2] Writing newsletter...", "agent");
      const draft = await this.writeNewsletter(research, issueNumber);

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

    // Main story research
    researchPrompts.push({
      category: "Main Story",
      prompt: `Research this AI news story in detail: "${content.mainStory.title}"${content.mainStory.url ? `\nOriginal source: ${content.mainStory.url}` : ''}

Provide:
- Key facts, statistics, dates, and verified claims
- Quotes from key people or organizations
- Context and background (why this matters)
- Multiple reputable sources
- Any verification concerns

Focus on recent sources (last 7 days preferred). Include canonical URLs without tracking parameters.`,
    });

    // Secondary story research
    if (content.secondaryStory) {
      researchPrompts.push({
        category: "Secondary Story",
        prompt: `Research this AI news story: "${content.secondaryStory.title}"${content.secondaryStory.url ? `\nOriginal source: ${content.secondaryStory.url}` : ''}

Provide:
- Key facts and verified claims
- Important quotes
- Context and significance
- Reputable sources

Focus on recent sources. Include clean URLs.`,
      });
    }

    // Weekly Scoop research
    if (content.quickLinks && content.quickLinks.length > 0) {
      // Research provided quick links
      content.quickLinks.forEach((link, i) => {
        researchPrompts.push({
          category: `Weekly Scoop #${i + 1}`,
          prompt: `Research this AI news item: "${link.title}"${link.url ? `\nSource: ${link.url}` : ''}

Provide a brief summary (2-3 sentences) with key facts and the source URL.`,
        });
      });
    } else {
      // Find 6 diverse AI stories for Weekly Scoop
      researchPrompts.push({
        category: "Weekly Scoop",
        prompt: `Find 6 diverse, newsworthy AI stories from the past week. For each story:
- Provide a brief headline
- 1-2 sentence summary
- Source URL from a reputable outlet

Cover different topics: regulations, product launches, research, company news, controversies, etc.`,
      });
    }

    // Weekly Challenge research
    if (content.challenge) {
      researchPrompts.push({
        category: "Weekly Challenge",
        prompt: `Find resources for this weekly challenge: "${content.challenge.title}"${content.challenge.description ? `\nDescription: ${content.challenge.description}` : ''}

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

    // Build comprehensive research document with URL bank
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

    log(`[Writer] Research complete. Found ${results.reduce((sum, r) => sum + r.citations.length, 0)} verified URLs`, "agent");

    return fullResearch;
  }

  /**
   * Phase 2: Write newsletter using Gemini Flash Preview with style guide
   * AI crafts the final newsletter following all rules
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

# REQUIRED COMPLETE STRUCTURE - YOU MUST INCLUDE ALL OF THESE SECTIONS:

**Section 1: Subject Line** (40-60 characters)
**Section 2: Preview Text** (Tease secondary story + one Weekly Scoop item)
**Section 3: Newsletter Title** (≤60 characters, fresh angle on main story)
**Section 4: Welcome To This Week's Edition Of Jumble** (45-70 words, end with ⬇️)
**Section 5: In this newsletter:** (Exactly 5 bullets with emojis)
**Section 6: Main Story** (H1 with emoji, ~400 words, 2-3 H2 subsections with emojis)
**Section 7: Secondary Story** (H1 with emoji, ~350 words, 1-3 H2 subsections with emojis)
**Section 8: Weekly Scoop 📢** (Exactly 6 headlines, each with emoji and unique link)
**Section 9: Weekly Challenge** (150-200 words with clear steps or scoring)
**Section 10: Wrap Up** (Bold 1-2 lines inviting replies)

⚠️ CRITICAL: You MUST complete ALL 10 sections above. Do NOT stop early or skip sections. The newsletter is NOT complete without all sections.

# 🚨 CRITICAL URL RULES - READ CAREFULLY:

1. **ONLY USE URLs FROM THE "VERIFIED URL BANK" SECTION** in the research notes above
2. **COPY URLs EXACTLY** character-for-character - do NOT modify, shorten, or recreate them
3. **DO NOT INVENT OR HALLUCINATE URLs** - if you need a URL, it MUST be in the URL bank
4. **NO PLACEHOLDERS** - do not use example.com or any fake URLs
5. If you can't find a URL in the bank for a claim, either:
   - Find a different claim from the research that HAS a URL in the bank
   - OR omit that specific claim

Ensure all word counts, formatting rules, and link standards are strictly followed.

CRITICAL OUTPUT INSTRUCTIONS:
1. Do NOT include any internal thought process, reasoning, or conversational text.
2. Output ONLY the final newsletter content.
3. Output the COMPLETE newsletter with ALL 10 sections listed above.
4. Wrap the entire output in a markdown code block (\`\`\`markdown ... \`\`\`).`;

    let draft = await geminiService.generateWithPro(writePrompt, {
      temperature: 0.5, // Lower temp to reduce URL hallucination (was 0.8)
      maxTokens: 16384, // Increased from 8192 to ensure full newsletter fits
    });

    // Extract markdown from code block if present
    const match = draft.match(/```markdown\n([\s\S]*?)\n?```/);
    if (match) {
      draft = match[1];
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
      }
    }

    return draft;
  }

}

// Singleton instance
export const writerAgent = new WriterAgent();
