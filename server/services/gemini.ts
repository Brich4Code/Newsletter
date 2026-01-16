import { GoogleGenerativeAI, GenerativeModel, Content } from "@google/generative-ai";
import { log } from "../index";

export interface GenerationOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

/**
 * Service wrapper for Google Gemini AI
 * Provides access to Flash (fast reasoning) and Pro (complex tasks) models
 * Uses lazy initialization to avoid crashes when API key is not set at startup
 */
export class GeminiService {
  private genAI: GoogleGenerativeAI | null = null;
  private flashModel: GenerativeModel | null = null;
  private proModel: GenerativeModel | null = null;

  /**
   * Initialize the service (lazy - only called when first needed)
   */
  private initialize(): void {
    if (this.genAI) {
      return; // Already initialized
    }

    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GOOGLE_AI_API_KEY environment variable is not set. " +
        "Please configure it in Replit Secrets or your .env file."
      );
    }

    this.genAI = new GoogleGenerativeAI(apiKey);

    // Gemini 2.0 Flash for fast operations (research, ranking, quick decisions)
    this.flashModel = this.genAI.getGenerativeModel({
      model: "gemini-2.0-flash-exp",
    });

    // Gemini 1.5 Pro for complex operations (writing, fact-checking)
    this.proModel = this.genAI.getGenerativeModel({
      model: "gemini-1.5-pro",
    });

    log("[Gemini] Service initialized successfully", "gemini");
  }

  /**
   * Generate content using Gemini Flash (fast, lightweight)
   * Use for: Research, ranking, quick decisions
   */
  async generateWithFlash(prompt: string, options?: GenerationOptions): Promise<string> {
    this.initialize();

    try {
      log("[Gemini Flash] Generating...", "gemini");
      const result = await this.flashModel!.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: options?.temperature ?? 0.7,
          maxOutputTokens: options?.maxTokens ?? 2048,
          topP: options?.topP,
          topK: options?.topK,
        },
      });

      const response = result.response;
      return response.text();
    } catch (error) {
      log(`[Gemini Flash] Error: ${error}`, "gemini");
      throw new Error(`Gemini Flash generation failed: ${error}`);
    }
  }

  /**
   * Generate content using Gemini Pro (powerful, complex reasoning)
   * Use for: Writing newsletters, fact-checking, complex analysis
   */
  async generateWithPro(prompt: string, options?: GenerationOptions): Promise<string> {
    this.initialize();

    try {
      log("[Gemini Pro] Generating...", "gemini");
      const result = await this.proModel!.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: options?.temperature ?? 0.7,
          maxOutputTokens: options?.maxTokens ?? 8192,
          topP: options?.topP,
          topK: options?.topK,
        },
      });

      const response = result.response;
      return response.text();
    } catch (error) {
      log(`[Gemini Pro] Error: ${error}`, "gemini");
      throw new Error(`Gemini Pro generation failed: ${error}`);
    }
  }

  /**
   * Search the web using Gemini's grounding feature
   * Returns recent, relevant search results
   */
  async searchGrounded(query: string): Promise<SearchResult[]> {
    this.initialize();

    try {
      log(`[Gemini Search] Query: ${query}`, "gemini");

      // Use Gemini with Google Search grounding
      const result = await this.flashModel!.generateContent({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Search for: ${query}

Return results as JSON array with this exact structure:
[
  {
    "title": "Article title",
    "url": "https://example.com/article",
    "snippet": "Brief summary of the article"
  }
]

Requirements:
- Return 5-10 most relevant results
- Only include articles from the last 7 days
- Prefer authoritative AI news sources
- Include full URLs without tracking parameters`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.3,
        },
        tools: [
          {
            googleSearch: {},
          },
        ],
      });

      const response = result.response;
      const text = response.text();

      // Extract JSON from response
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        log("[Gemini Search] No valid JSON found in response", "gemini");
        return [];
      }

      const results: SearchResult[] = JSON.parse(jsonMatch[0]);
      log(`[Gemini Search] Found ${results.length} results`, "gemini");
      return results;
    } catch (error) {
      log(`[Gemini Search] Error: ${error}`, "gemini");
      return [];
    }
  }

  /**
   * Generate text embeddings using text-embedding-004
   * Returns 768-dimensional vector for semantic search
   */
  async embed(text: string): Promise<number[]> {
    this.initialize();

    try {
      const embeddingModel = this.genAI!.getGenerativeModel({
        model: "text-embedding-004",
      });

      const result = await embeddingModel.embedContent({
        content: {
          role: "user",
          parts: [{ text }],
        },
      });

      return result.embedding.values;
    } catch (error) {
      log(`[Gemini Embedding] Error: ${error}`, "gemini");
      throw new Error(`Embedding generation failed: ${error}`);
    }
  }

  /**
   * Generate structured JSON output using Gemini
   */
  async generateJSON<T>(prompt: string, options?: GenerationOptions): Promise<T> {
    const response = await this.generateWithFlash(prompt, options);

    // Extract JSON from markdown code blocks if present
    const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```/) || response.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error("No valid JSON found in response");
    }

    return JSON.parse(jsonMatch[1] || jsonMatch[0]);
  }
}

// Singleton instance
export const geminiService = new GeminiService();
