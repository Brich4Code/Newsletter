import { log } from "../index";

export interface PerplexitySearchResult {
  answer: string;
  citations: string[];
}

/**
 * Perplexity Service via OpenRouter
 * Uses perplexity/sonar-pro-search for accurate research with verified URLs
 *
 * Perplexity is specifically designed for research and provides:
 * - Verified, working URLs (not hallucinated)
 * - Recent sources (web search built-in)
 * - Accurate citations
 * - Fact-checked information
 */
export class PerplexityService {
  private apiKey: string | null = null;
  private baseUrl = "https://openrouter.ai/api/v1/chat/completions";
  private model = "perplexity/sonar-pro-search";

  /**
   * Initialize the service (lazy - only called when first needed)
   */
  private initialize(): void {
    if (this.apiKey) {
      return; // Already initialized
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OPENROUTER_API_KEY environment variable is not set. " +
        "Please configure it in Replit Secrets or your .env file."
      );
    }

    this.apiKey = apiKey;
    log("[Perplexity] Service initialized successfully", "perplexity");
  }

  /**
   * Search and research a topic using Perplexity
   * Returns comprehensive research with verified URLs
   */
  async research(prompt: string): Promise<PerplexitySearchResult> {
    this.initialize();

    try {
      log("[Perplexity] Researching...", "perplexity");

      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://newsletter.jumble.ai",
          "X-Title": "Hello Jumble Newsletter Research",
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.3, // Lower for factual research
          max_tokens: 4000,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Perplexity API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const answer = data.choices?.[0]?.message?.content || "";

      // Extract citations from response
      // Perplexity typically includes citations inline or in metadata
      const citations = this.extractCitations(answer);

      log(`[Perplexity] Research complete. Found ${citations.length} citations`, "perplexity");

      return {
        answer,
        citations,
      };
    } catch (error) {
      log(`[Perplexity] Error: ${error}`, "perplexity");
      throw new Error(`Perplexity research failed: ${error}`);
    }
  }

  /**
   * Extract URLs from Perplexity's response
   * Perplexity includes citations in markdown format or at the end
   */
  private extractCitations(text: string): string[] {
    const urls: string[] = [];

    // Match markdown links: [text](url)
    const markdownLinks = text.match(/\[([^\]]+)\]\(([^)]+)\)/g);
    if (markdownLinks) {
      markdownLinks.forEach(link => {
        const urlMatch = link.match(/\(([^)]+)\)/);
        if (urlMatch) {
          urls.push(urlMatch[1]);
        }
      });
    }

    // Match bare URLs (http/https)
    const bareUrls = text.match(/https?:\/\/[^\s)]+/g);
    if (bareUrls) {
      bareUrls.forEach(url => {
        // Remove trailing punctuation
        const cleanUrl = url.replace(/[.,;!?]+$/, '');
        if (!urls.includes(cleanUrl)) {
          urls.push(cleanUrl);
        }
      });
    }

    // Deduplicate URLs
    return Array.from(new Set(urls));
  }

  /**
   * Research multiple stories in parallel
   * Returns combined research with all citations
   */
  async researchMultiple(prompts: string[]): Promise<{
    results: PerplexitySearchResult[];
    allCitations: string[];
  }> {
    this.initialize();

    log(`[Perplexity] Researching ${prompts.length} stories in parallel...`, "perplexity");

    const results = await Promise.all(
      prompts.map(prompt => this.research(prompt))
    );

    // Combine all citations
    const allCitations = Array.from(
      new Set(results.flatMap(r => r.citations))
    );

    log(`[Perplexity] All research complete. Total citations: ${allCitations.length}`, "perplexity");

    return {
      results,
      allCitations,
    };
  }
}

// Singleton instance
export const perplexityService = new PerplexityService();
