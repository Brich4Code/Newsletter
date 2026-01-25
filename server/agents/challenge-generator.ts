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
- Use ONLY the LATEST AI tools from 2026 (GPT-4.5/ChatGPT-4o, Claude 3.7 Opus/Sonnet, Gemini 2.5+, NotebookLM, Midjourney v7, Perplexity, Gamma, DALL-E 4, Suno v4, RunwayML Gen-4, etc.)
- NO outdated tools (anything pre-2026 like GPT-3.5, Claude 3.5, Gemini 2.0, Midjourney v6, etc.)
- Focus on "doing something cool" or "saving time" with cutting-edge AI
- FUN and engaging (not just "summarize an email")
- Should require 4-7 clear steps to complete
- Use tools that exist in early 2026 (be realistic about what's available)

Examples of good challenges:
- "Create a family recipe book using ChatGPT-4o and Midjourney v7"
- "Build a presentation with Gamma AI in under 10 minutes"
- "Use NotebookLM to create a podcast from your meeting notes"
- "Generate a personalized workout plan with Claude 3.7 and track it in Notion"
- "Create a music video using Suno v4 and RunwayML Gen-4"

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
