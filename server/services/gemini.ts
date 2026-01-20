import { GoogleGenerativeAI, GenerativeModel, Content } from "@google/generative-ai";
import { log } from "../index";

export interface GenerationOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  useGroundedSearch?: boolean; // Enable Google Search grounding
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

    // Gemini 3 Flash Preview for all operations
    this.flashModel = this.genAI.getGenerativeModel({
      model: "gemini-3-flash-preview",
    });

    // Gemini 3 Flash Preview for complex operations too
    this.proModel = this.genAI.getGenerativeModel({
      model: "gemini-3-flash-preview",
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
      const maxTokens = options?.maxTokens ?? 8192;
      log(`[Gemini Pro] Generating${options?.useGroundedSearch ? ' with Google Search grounding' : ''} (maxOutputTokens: ${maxTokens})...`, "gemini");

      const result = await this.proModel!.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: options?.temperature ?? 0.7,
          maxOutputTokens: maxTokens,
          topP: options?.topP,
          topK: options?.topK,
        },
        ...(options?.useGroundedSearch && {
          tools: [
            {
              googleSearch: {},
            },
          ],
        }),
      });

      const response = result.response;
      const text = response.text();

      // Check for finish reason to diagnose early stops
      const candidates = response.candidates;
      if (candidates && candidates.length > 0) {
        const finishReason = candidates[0].finishReason;
        log(`[Gemini Pro] Finish reason: ${finishReason}`, "gemini");

        if (finishReason === 'MAX_TOKENS') {
          log(`[Gemini Pro] ⚠️ Output was truncated due to max token limit`, "gemini");
        } else if (finishReason === 'SAFETY') {
          log(`[Gemini Pro] ⚠️ Output was blocked by safety filters`, "gemini");
        } else if (finishReason !== 'STOP') {
          log(`[Gemini Pro] ⚠️ Unexpected finish reason: ${finishReason}`, "gemini");
        }
      }

      return text;
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

      // Use Gemini with Google Search grounding - ask for JSON format with URLs
      const result = await this.flashModel!.generateContent({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Search for recent news about: ${query}

Return your findings as a JSON array with this exact format:
[
  {
    "title": "Article headline",
    "url": "https://actual-website.com/article-path",
    "snippet": "1-2 sentence summary"
  }
]

Requirements:
- Return 5-8 results maximum
- Only include articles from reputable news sources
- Include the ACTUAL article URL (not a redirect URL)
- Focus on articles from the last 7 days
- Return ONLY the JSON array, no other text`,
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

      // Try to parse JSON from response
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          const results: SearchResult[] = JSON.parse(jsonMatch[0]);
          log(`[Gemini Search] Found ${results.length} results from JSON response`, "gemini");
          return results.filter(r => r.url && r.title && !r.url.includes('vertexaisearch.cloud.google.com'));
        } catch (parseError) {
          log(`[Gemini Search] JSON parse error: ${parseError}`, "gemini");
        }
      }

      // Fallback: try grounding metadata
      const candidates = response.candidates;
      if (candidates && candidates.length > 0) {
        const groundingMetadata = candidates[0].groundingMetadata;
        const results: SearchResult[] = [];

        if (groundingMetadata?.groundingChunks) {
          for (const chunk of groundingMetadata.groundingChunks) {
            if (chunk.web?.uri && chunk.web?.title) {
              results.push({
                title: chunk.web.title,
                url: chunk.web.uri,
                snippet: chunk.web.title,
              });
            }
          }
        }

        if (results.length > 0) {
          log(`[Gemini Search] Found ${results.length} results from grounding metadata`, "gemini");
          return results;
        }
      }

      log("[Gemini Search] No results found", "gemini");
      return [];
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

    // First try standard regex (often cleaner)
    let jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```/) ||
      response.match(/```\n?([\s\S]*?)\n?```/);

    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1].trim());
      } catch (e) {
        log(`[Gemini] Regex match failed to parse: ${e}`, "gemini");
        // Fallthrough to manual extraction
      }
    }

    // Fallback: Manual extraction of { ... } or [ ... ]
    // This is robust against extra text before/after
    const firstBrace = response.indexOf('{');
    const lastBrace = response.lastIndexOf('}');
    const firstBracket = response.indexOf('[');
    const lastBracket = response.lastIndexOf(']');

    let jsonString = '';

    // Determine if it's likely an array or object based on which comes first
    // Default to whichever valid pair encloses the most content or appears first
    const hasObject = firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace;
    const hasArray = firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket;

    if (hasArray && (!hasObject || firstBracket < firstBrace)) {
      jsonString = response.substring(firstBracket, lastBracket + 1);
    } else if (hasObject) {
      jsonString = response.substring(firstBrace, lastBrace + 1);
    } else {
      throw new Error("No valid JSON structure ({...} or [...]) found in response");
    }

    try {
      return JSON.parse(jsonString);
    } catch (e) {
      log(`[Gemini] Manual extraction failed to parse: ${e}`, "gemini");
      throw new Error(`Failed to parse extracted JSON: ${e}`);
    }
  }
}

// Singleton instance
export const geminiService = new GeminiService();
