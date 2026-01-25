import { geminiService } from "../services/gemini";
import { storage } from "../storage";
import { log } from "../index";
import { perplexityService } from "../services/perplexity";

/**
 * Challenge Generator Agent
 * Creates weekly AI coding challenges for the newsletter
 * Automatically fetches latest AI models to stay current
 */
export class ChallengeGeneratorAgent {
  async run(): Promise<void> {
    log("[ChallengeGenerator] Creating weekly challenges...", "agent");

    try {
      // First, fetch the latest AI models using Perplexity web search
      log("[ChallengeGenerator] Fetching latest AI models...", "agent");
      const modelsResearch = await perplexityService.research(
        `What are the latest AI models and tools available as of ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}? ` +
        `List the current versions for: OpenAI GPT/ChatGPT, Anthropic Claude, Google Gemini, Midjourney, DALL-E, Suno, RunwayML, and any other popular AI tools. ` +
        `Only include models that are currently publicly available.`
      );

      log(`[ChallengeGenerator] Latest models researched: ${modelsResearch.answer.substring(0, 200)}...`, "agent");

      const prompt = `Generate 5 creative, practical, and non-technical AI challenges for a weekly newsletter.

LATEST AI MODELS (use these):
${modelsResearch.answer}

REQUIREMENTS:
- Accessible to non-experts (no coding required unless it's low-code/no-code like Zapier/Make)
- Solvable in 20-60 minutes
- Use ONLY the LATEST AI tools mentioned above
- Focus on "doing something cool" or "saving time" with cutting-edge AI
- FUN and engaging (not just "summarize an email")
- Should require 4-7 clear steps to complete

Examples of good challenges:
- "Create a family recipe book using the latest GPT and Midjourney models"
- "Build a presentation with Gamma AI in under 10 minutes"
- "Use NotebookLM to create a podcast from your meeting notes"
- "Generate a personalized workout plan with latest Claude and track it in Notion"
- "Create a music video using latest Suno and RunwayML versions"

Each challenge should have:
- Catchy title (under 60 chars)
- Description (120-150 words) with 4-7 clear, simple steps
- Type: "creative", "productivity", "prompt_engineering", or "no_code"
- Use the specific model names from the LATEST AI MODELS section above

Return as JSON array:
[
  {
    "title": "Challenge title",
    "description": "Full description with clear steps",
    "type": "challenge_type"
  }
]

Generate 5 creative, practical, and non-technical AI challenges for a weekly newsletter.

`;

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
