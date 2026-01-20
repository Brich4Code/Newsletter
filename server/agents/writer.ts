import { geminiService } from "../services/gemini";
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
 * 1. Phase 1 (Gemini Pro): Research stories using grounded search, fact-check, gather sources
 * 2. Phase 2 (Gemini Flash Preview): Write newsletter following style guide
 *
 * REMOVED:
 * - Pre-fetched story summaries
 * - Separate investigator agent
 * - Separate compliance officer agent
 * - Complex prompt building with embedded content
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
      // Phase 1: Research and fact-check using Gemini Pro with grounded search
      log("[Writer Phase 1] Researching and fact-checking stories...", "agent");
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
   * Phase 1: Research all stories using Gemini Pro with grounded search
   * AI finds sources, fact-checks, and gathers detailed information
   */
  private async researchStories(content: SimpleIssueContent): Promise<string> {
    const researchPrompt = `You are a research assistant for the Hello Jumble AI newsletter. Research the following stories using Google Search and gather comprehensive, fact-checked information.

# STORIES TO RESEARCH:

## Main Story
${content.mainStory.url ? `Title: ${content.mainStory.title}\nSource URL: ${content.mainStory.url}` : `Topic: ${content.mainStory.title}`}

${content.secondaryStory ? `## Secondary Story
${content.secondaryStory.url ? `Title: ${content.secondaryStory.title}\nSource URL: ${content.secondaryStory.url}` : `Topic: ${content.secondaryStory.title}`}` : ''}

${content.quickLinks && content.quickLinks.length > 0 ? `## Quick Links for Weekly Scoop
${content.quickLinks.map((link, i) =>
  link.url ? `${i + 1}. ${link.title}\n   URL: ${link.url}` : `${i + 1}. ${link.title}`
).join('\n')}

Note: Find 6 diverse, newsworthy AI stories from the past week for Weekly Scoop section` : `## Weekly Scoop
Find 6 diverse, newsworthy AI stories from the past week`}

${content.challenge ? `## Weekly Challenge
Title: ${content.challenge.title}
${content.challenge.description ? `Description: ${content.challenge.description}` : ''}

Find relevant tutorials, videos, or resources for this challenge.` : ''}

# RESEARCH REQUIREMENTS:

For each story:
1. Use Google Search to find recent, reputable sources (within last 7 days preferred)
2. Fact-check all claims and statistics - verify with multiple sources
3. Gather key details, quotes, context, and background
4. Find primary sources when possible (original announcements, company blogs, etc.)
5. For videos/posts, get the actual publisher URL, not rehosted clips
6. Note any verification issues or conflicting information

# OUTPUT FORMAT:

Provide comprehensive research notes for each story including:
- **Key Facts**: Verified statistics, dates, names, and claims
- **Sources**: Canonical URLs from reputable outlets (no tracking params)
- **Quotes**: Important statements from key people/entities
- **Context**: Background and why this matters
- **Verification Notes**: Any concerns or conflicting info

⚠️ CRITICAL - END YOUR RESEARCH WITH THIS SECTION:

---
# VERIFIED URL BANK
(List ALL URLs found during research. The writer will ONLY use URLs from this list.)

Main Story URLs:
- [URL 1]
- [URL 2]
...

Secondary Story URLs:
- [URL 1]
- [URL 2]
...

Weekly Scoop URLs:
- [URL 1]
- [URL 2]
...

Weekly Challenge URLs:
- [URL 1]
...

⚠️ Copy each URL exactly character-for-character. No shortened URLs, no modified URLs. These will be the ONLY URLs used in the newsletter.
---

Be thorough - this research will be used to write the newsletter.`;

    const research = await geminiService.generateWithPro(researchPrompt, {
      temperature: 0.3, // Lower temperature for factual research
      maxTokens: 8192,
      useGroundedSearch: true, // Enable Google Search grounding for research
    });

    return research;
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
