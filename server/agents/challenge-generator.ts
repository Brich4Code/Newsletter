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
- Solvable in 15-45 minutes
- Related to using NEW AI tools, features, or creative prompting
- Focus on "doing something cool" or "saving time" 
- FUN and engaging (not just "summarize an email")

Examples of good challenges:
- "Create a family recipe book using ChatGPT and an image generator"
- "Build a simple personal budget tracker using Claude and a spreadsheet"
- "Use an AI music generator to create a theme song for your pet"
- "Set up a Google Alert + AI summary workflow"

Each challenge should have:
- Catchy title (under 60 chars)
- Description (150-200 words) with simple, clear steps
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
    }
  }
}

// Singleton instance
export const challengeGeneratorAgent = new ChallengeGeneratorAgent();
