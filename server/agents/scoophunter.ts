import { geminiService } from "../services/gemini";
import { vectorSearchService } from "../services/vector-search";
import { storage } from "../storage";
import { log } from "../index";

export interface Candidate {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

export interface ScoredCandidate extends Candidate {
  summary: string;
  relevanceScore: number;
}

/**
 * ScoopHunter Agent
 * Continuously researches AI news and populates the database with fresh leads
 * Uses Gemini Flash + Search Grounding for research
 */
export class ScoopHunterAgent {
  private readonly MIN_RELEVANCE_SCORE = 70; // Only store leads scoring 70+

  async run(): Promise<void> {
    log("[ScoopHunter] Starting research cycle...", "agent");

    try {
      // 1. Search for AI news across multiple angles
      const searchQueries = [
        "latest AI breakthroughs and announcements this week",
        "new AI models and research papers released",
        "AI startup funding and company news",
        "AI product launches and updates",
        "AI regulation and policy news",
      ];

      const allCandidates: Candidate[] = [];

      for (const query of searchQueries) {
        log(`[ScoopHunter] Searching: ${query}`, "agent");
        const results = await geminiService.searchGrounded(query);

        for (const result of results) {
          // 2. Check for duplicates (URL and semantic)
          const duplicateCheck = await vectorSearchService.checkDuplicate(
            result.url,
            result.title
          );

          if (duplicateCheck.isDuplicate) {
            log(
              `[ScoopHunter] Skipping duplicate: ${result.title} (${duplicateCheck.matchType})`,
              "agent"
            );
            continue;
          }

          // Extract source domain from URL
          const source = this.extractSource(result.url);

          allCandidates.push({
            title: result.title,
            url: this.cleanUrl(result.url),
            snippet: result.snippet,
            source,
          });
        }
      }

      if (allCandidates.length === 0) {
        log("[ScoopHunter] No new candidates found", "agent");
        return;
      }

      log(`[ScoopHunter] Found ${allCandidates.length} unique candidates`, "agent");

      // 3. Score relevance and generate summaries
      const scoredCandidates = await this.scoreAndSummarize(allCandidates);

      // 4. Store high-quality leads in database
      let storedCount = 0;
      for (const candidate of scoredCandidates) {
        if (candidate.relevanceScore >= this.MIN_RELEVANCE_SCORE) {
          await storage.createLead({
            title: candidate.title,
            url: candidate.url,
            summary: candidate.summary,
            source: candidate.source,
            relevanceScore: candidate.relevanceScore,
          });

          // Add to history for future deduplication
          await vectorSearchService.addToHistory(candidate.url, candidate.title);

          storedCount++;
        }
      }

      log(`[ScoopHunter] Research complete. Stored ${storedCount} new leads.`, "agent");
    } catch (error) {
      log(`[ScoopHunter] Error: ${error}`, "agent");
    }
  }

  /**
   * Score relevance and generate summaries for candidates
   */
  private async scoreAndSummarize(candidates: Candidate[]): Promise<ScoredCandidate[]> {
    const scored: ScoredCandidate[] = [];

    for (const candidate of candidates) {
      try {
        const prompt = `Analyze this AI news story for the Hello Jumble newsletter:

Title: ${candidate.title}
Snippet: ${candidate.snippet}
Source: ${candidate.source}

Tasks:
1. Score the relevance for a newsletter about AI/ML news (0-100):
   - Recent, newsworthy AI developments: High score
   - Minor updates or old news: Low score
   - Technical depth and significance: Bonus points
   - Source credibility: Consider reputation

2. Write a 1-2 sentence summary suitable for a newsletter lead selection interface.

Return JSON:
{
  "relevanceScore": number (0-100),
  "summary": "string (1-2 sentences)",
  "reasoning": "Brief explanation of score"
}`;

        const response = await geminiService.generateJSON<{
          relevanceScore: number;
          summary: string;
          reasoning: string;
        }>(prompt);

        scored.push({
          ...candidate,
          summary: response.summary,
          relevanceScore: Math.round(response.relevanceScore),
        });

        log(
          `[ScoopHunter] Scored: "${candidate.title}" = ${response.relevanceScore}/100`,
          "agent"
        );
      } catch (error) {
        log(`[ScoopHunter] Failed to score candidate: ${error}`, "agent");
        // Skip candidates that fail scoring
      }
    }

    return scored.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Extract source domain from URL
   */
  private extractSource(url: string): string {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;

      // Remove www. prefix
      return hostname.replace(/^www\./, "");
    } catch {
      return "Unknown Source";
    }
  }

  /**
   * Clean URL by removing tracking parameters
   */
  private cleanUrl(url: string): string {
    try {
      const urlObj = new URL(url);

      // Remove tracking parameters
      const paramsToRemove = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "ref", "share"];

      paramsToRemove.forEach(param => {
        urlObj.searchParams.delete(param);
      });

      return urlObj.toString();
    } catch {
      return url; // Return original if parsing fails
    }
  }
}

// Singleton instance
export const scoopHunterAgent = new ScoopHunterAgent();
