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
      let draft = await geminiService.generateWithPro(prompt, {
        temperature: 0.8, // More creative for writing
        maxTokens: 8192,
      });

      // Extract markdown from code block if present
      const match = draft.match(/```markdown\n([\s\S]*?)\n?```/);
      if (match) {
        draft = match[1];
      } else {
        // Fallback: strip any leading conversational text if no code block
        // Look for the start of the newsletter (usually Subject Line or Welcome)
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

Write the complete newsletter following the structure and rules defined in the STYLE GUIDE section above.
Use the content provided above to fill the sections.

Ensure all word counts and formatting rules are strictly followed.

CRITICAL OUTPUT INSTRUCTIONS:
1. Do NOT include any internal thought process, reasoning, or conversational text.
2. Output ONLY the final newsletter content.
3. Wrap the entire output in a markdown code block (```markdown ... ```).`;
  }

}

// Singleton instance
export const writerAgent = new WriterAgent();
