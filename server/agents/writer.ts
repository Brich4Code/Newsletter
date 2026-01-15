import { geminiService } from "../services/gemini";
import { NewsletterStyleGuide } from "../config/style-guide";
import { log } from "../index";
import type { Lead, Challenge } from "@shared/schema";

export interface IssueContent {
  mainStory: Lead;
  secondaryStory: Lead | null;
  quickLinks: Lead[];
  challenge: Challenge | null;
}

/**
 * Writer Agent
 * Generates newsletter drafts following the Hello Jumble style guide
 * Uses Gemini Pro for high-quality, rule-compliant writing
 */
export class WriterAgent {
  async generateNewsletter(content: IssueContent, issueNumber: number): Promise<string> {
    log("[Writer] Generating newsletter draft...", "agent");

    try {
      const prompt = this.buildPrompt(content, issueNumber);
      const draft = await geminiService.generateWithPro(prompt, {
        temperature: 0.8, // More creative for writing
        maxTokens: 8192,
      });

      log("[Writer] Draft generated successfully", "agent");
      return draft;
    } catch (error) {
      log(`[Writer] Error: ${error}`, "agent");
      throw new Error(`Failed to generate newsletter: ${error}`);
    }
  }

  /**
   * Build comprehensive prompt with style guide and content
   */
  private buildPrompt(content: IssueContent, issueNumber: number): string {
    const { mainStory, secondaryStory, quickLinks, challenge } = content;

    return `You are the writer for Hello Jumble, a newsletter about AI news. You are generating Issue #${issueNumber}.

# CRITICAL STYLE GUIDE - YOU MUST FOLLOW THESE RULES:

${NewsletterStyleGuide.rules}

# CONTENT TO WRITE ABOUT:

## Main Story
Title: ${mainStory.title}
Source: ${mainStory.source}
URL: ${mainStory.url}
Summary: ${mainStory.summary}

${secondaryStory ? `## Secondary Story
Title: ${secondaryStory.title}
Source: ${secondaryStory.source}
URL: ${secondaryStory.url}
Summary: ${secondaryStory.summary}` : ''}

## Quick Links (Weekly Scoop)
${quickLinks.map((link, i) => `${i + 1}. ${link.title}
   Source: ${link.source}
   URL: ${link.url}`).join('\n')}

${challenge ? `## Weekly Challenge
Title: ${challenge.title}
Description: ${challenge.description}
Type: ${challenge.type}` : ''}

# YOUR TASK:

Write a complete newsletter following this EXACT structure:

## 1. Welcome Section (45-70 words)
Start with: "Welcome to Jumble, your go-to source for AI news updates."
Tease the main story and secondary story.
End with: "Let's dive in ⬇️"

## 2. In this newsletter
Create exactly 5 bullets with emojis (sentence case with first word capitalized):
- Main story (short, catchy headline - do NOT use same words as the H1 you'll write later)
- Secondary story (short headline - do NOT use same words as the H2 later)
- Two Weekly Scoop items (pick 2 most interesting from the list, rename them creatively)
- Weekly Challenge: ${challenge?.title || 'Challenge name'}

CRITICAL: Do not reuse words or emojis from these bullets in your later H1, H2, or H3 headers!

## 3. Main Story
Write in this format:
# [Emoji] [Catchy H1 in Title Case - no punctuation]

[One engaging intro paragraph setting up the story]

[Space for hero image - write: *[Hero image placeholder]*]

## [Emoji] [H2 with distinct angle - Title Case, no punctuation]
[Paragraph explaining this angle]

### [Emoji] [H3 with another angle - Title Case]
[Paragraph with details]

### [Emoji] [H3 with final angle - Title Case]
[Paragraph wrapping up]

Target: ~400 words total
REMEMBER: Embed the source link naturally over a 3-9 word noun phrase. Example: [groundbreaking research from Stanford](${mainStory.url})

${secondaryStory ? `## 4. Secondary Story
# [Emoji] [H2 in Title Case - no punctuation]

[Intro paragraph]

## [Emoji] [H3 angle 1]
[Details]

## [Emoji] [H3 angle 2]
[Details]

Target: ~350 words
Embed link: ${secondaryStory.url}` : ''}

## 5. Weekly Scoop 📢
Write exactly 6 items (use all from the list):
${quickLinks.map((link, i) => `[Emoji${i + 1}] [One-line headline with embedded link]`).join('\n')}

Format each like:
🦴 [Natural anchor text 3-9 words](${quickLinks[0]?.url})

CRITICAL RULES:
- Each item gets ONE unique emoji
- Embed the URL over a natural 3-9 word phrase
- No bare URLs
- No "click here" or "read more"
- Use varied, high-quality sources
- Do NOT repeat any stories from main or secondary sections

${challenge ? `## 6. 🎯 Weekly Challenge: ${challenge.title}

Write 150-200 words explaining:
- What the challenge is
- Clear steps to complete it
- What the reader will learn

Make it fun and achievable!` : ''}

## 7. Wrap Up
Write 1-2 bold lines inviting reader replies or opinions.
End with: "See you next time! 🚀"

# CRITICAL REMINDERS:

1. NO punctuation in headers (no colons, dashes, commas)
2. All headers use Title Case
3. NO bare URLs - every link must be embedded over natural 3-9 word phrases
4. Do NOT lead with "According to"
5. Use each URL only ONCE
6. Strip tracking parameters from URLs (remove utm_, ref=, share=)
7. NO emojis in body text (only in headers and bullet points)
8. The "In this newsletter" bullets must NOT reuse words or emojis from later H1/H2/H3 headers
9. No two-part headers

Write the complete newsletter now in Markdown:`;
  }
}

// Singleton instance
export const writerAgent = new WriterAgent();
