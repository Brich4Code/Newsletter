import { geminiService } from "../services/gemini";
import { log } from "../index";
import type { Lead } from "@shared/schema";

/**
 * Illustrator Agent
 * Generates hero images for newsletter using image generation APIs
 * Note: Placeholder for now - requires Imagen or similar image API setup
 */
export class IllustratorAgent {
  async generateHeroImage(mainStory: Lead): Promise<{ imageUrl: string; prompt: string } | null> {
    log("[Illustrator] Generating hero image...", "agent");

    try {
      // Generate image prompt based on story
      const imagePrompt = await this.createImagePrompt(mainStory);

      log(`[Illustrator] Image prompt: ${imagePrompt}`, "agent");

      // Generate image using Gemini service (Pollinations.ai)
      const imageUrl = await geminiService.generateImage(imagePrompt);

      log(`[Illustrator] Image generated successfully: ${imageUrl}`, "agent");

      return {
        imageUrl,
        prompt: imagePrompt
      };

    } catch (error) {
      log(`[Illustrator] Error: ${error}`, "agent");
      return null;
    }
  }

  /**
   * Generate image from a custom prompt (for regeneration)
   */
  async generateFromPrompt(prompt: string): Promise<string> {
    log("[Illustrator] Generating image from custom prompt...", "agent");

    try {
      const imageUrl = await geminiService.generateImage(prompt);
      log(`[Illustrator] Image generated successfully: ${imageUrl}`, "agent");
      return imageUrl;
    } catch (error) {
      log(`[Illustrator] Error: ${error}`, "agent");
      throw error;
    }
  }

  /**
   * Create an image generation prompt from the story
   * Public method to allow generating prompts without images
   */
  async createImagePrompt(story: Lead): Promise<string> {
    const prompt = `Create a vivid, story-specific image generation prompt for this AI news story:

Story Title: "${story.title}"
Summary: ${story.summary}

Requirements:
- The image MUST visually represent the SPECIFIC story content, not just generic AI imagery
- Include concrete visual elements or metaphors directly related to the story's main topic
- Style: Modern, clean, vibrant colors, tech-forward but not overly abstract
- Mood: Professional but approachable
- Avoid: Generic geometric patterns, text in image, specific faces, logos
- Focus: A scene or composition that someone could look at and understand what the story is about

Return only the image prompt in 2-3 sentences that describes a SPECIFIC scene related to this story.`;

    const imagePrompt = await geminiService.generateWithFlash(prompt);
    return imagePrompt.trim();
  }

}

// Singleton instance
export const illustratorAgent = new IllustratorAgent();
