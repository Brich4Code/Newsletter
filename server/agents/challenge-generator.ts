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
      const prompt = `Generate 3 creative AI/ML coding challenges for a weekly newsletter.

REQUIREMENTS:
- Beginner to intermediate difficulty
- Solvable in 30-60 minutes
- Related to current AI/ML concepts or recent news
- Fun, educational, and practical
- Clear learning outcomes

Each challenge should have:
- Catchy title (under 60 chars)
- Clear description (150-200 words)
- Type: "code", "prompt_engineering", "data_analysis", or "model_training"

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
