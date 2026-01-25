import { geminiService } from "../services/gemini";
import { storage } from "../storage";
import { log } from "../index";

/**
 * Challenge Generator Agent
 * Creates weekly AI coding challenges for the newsletter
 */
export class ChallengeGeneratorAgent {
  async run(): Promise<void> {
    log("[ChallengeGenerator] Creating weekly challenges...", "agent");

    try {
      const prompt = `Generate 5 creative, practical, and non-technical AI challenges for a weekly newsletter.

REQUIREMENTS:
- Accessible to non-experts (no coding required unless it's low-code/no-code like Zapier/Make)
- Solvable in 20-60 minutes
- Use ONLY the LATEST AI tools from January 2026:
  * GPT-5.2 (Instant/Thinking/Pro), ChatGPT
  * Claude Opus 4.5, Claude Sonnet 4.5
  * Gemini 3 Flash, Gemini 3 Pro
  * Midjourney V7, Niji 7
  * DALL-E 3
  * Suno v4.5
  * RunwayML Gen-4
  * NotebookLM, Perplexity, Gamma
- NO outdated tools (anything older than late 2025)
- Focus on "doing something cool" or "saving time" with cutting-edge AI
- FUN and engaging (not just "summarize an email")
- Should require 4-7 clear steps to complete

Examples of good challenges:
- "Create a family recipe book using GPT-5.2 and Midjourney V7"
- "Build a presentation with Gamma AI in under 10 minutes"
- "Use NotebookLM to create a podcast from your meeting notes"
- "Generate a personalized workout plan with Claude Opus 4.5 and track it in Notion"
- "Create a music video using Suno v4.5 and RunwayML Gen-4"

Each challenge should have:
- Catchy title (under 60 chars)
- Description (120-150 words) with 4-7 clear, simple steps
- Type: "creative", "productivity", "prompt_engineering", or "no_code"

Return as JSON array:
[
  {
    "title": "Challenge title",
    "description": "Full description with clear steps",
    "type": "challenge_type"
  }
]`;

      const challenges = await geminiService.generateJSON<Array<{
        title: string;
        description: string;
        type: string;
      }>>(prompt);

      for (const challenge of challenges) {
        await storage.createChallenge({
          title: challenge.title,
          description: challenge.description,
          type: challenge.type,
        });

        log(`[ChallengeGenerator] Created: ${challenge.title}`, "agent");
      }

      log(`[ChallengeGenerator] Generated ${challenges.length} new challenges`, "agent");
    } catch (error) {
      log(`[ChallengeGenerator] Error: ${error}`, "agent");
      throw error; // Re-throw to allow caller to handle failure
    }
  }
}

// Singleton instance
export const challengeGeneratorAgent = new ChallengeGeneratorAgent();
