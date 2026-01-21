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

  // Title patterns that indicate roundup/digest articles (case insensitive)
  private readonly ROUNDUP_PATTERNS = [
    /\bthis week in\b/i,
    /\bweekly (digest|roundup|recap|update|news)\b/i,
    /\bdaily (digest|roundup|recap|news)\b/i,
    /\bnews (roundup|digest|recap)\b/i,
    /\b\d+ (things|stories|news|updates|trends)\b/i,  // "5 things", "10 stories"
    /\btop \d+\b/i,  // "top 10"
    /\bbest (of|ai tools)\b/i,
    /\beverything you need to know\b/i,
    /\bcomplete guide\b/i,
    /\bai (news|update),? (january|february|march|april|may|june|july|august|september|october|november|december)\b/i,
    /\b(january|february|march|april|may|june|july|august|september|october|november|december) \d{1,2},? \d{4}:? ai\b/i,
    /\blatest ai news and\b/i,
    /\bai trends in 202\d\b/i,
  ];

  /**
   * Check if title matches roundup patterns
   */
  private isRoundupByTitle(title: string): boolean {
    return this.ROUNDUP_PATTERNS.some(pattern => pattern.test(title));
  }

  async run(mode: "standard" | "deep-dive" = "standard"): Promise<void> {
    log(`[ScoopHunter] Starting research cycle in ${mode} mode...`, "agent");

    try {
      // Calculate date filter (last 7 days)
      const today = new Date();
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(today.getDate() - 7);
      const dateFilter = `after:${sevenDaysAgo.toISOString().split('T')[0]}`;

      let searchQueries: string[] = [];

      if (mode === "standard") {
        // Standard Mode: Use predefined topics with strict date filtering
        const baseTopics = [
          // Major company news
          `OpenAI news`,
          `Anthropic Claude news`,
          `Google Gemini news`,
          `Meta AI news`,
          // Product launches and updates
          `ChatGPT update OR new feature`,
          `AI product launch`,
          // Drama, conflict, business moves
          `AI company lawsuit OR controversy OR drama`,
          `Sam Altman OR Elon Musk AI news`,
          // Consumer and cultural impact
          `AI affecting jobs OR social media OR dating apps`,
          // Policy and regulation
          `AI regulation OR government policy`,
          // Hardware and devices
          `AI device OR AI hardware announcement`,
        ];

        searchQueries = baseTopics.map(topic => `${topic} ${dateFilter}`);
      } else {
        // Deep Dive Mode: specific dynamic queries
        searchQueries = await this.generateTrendQueries(dateFilter);
      }

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

          // 2b. Quick filter: Skip obvious roundup articles by title
          if (this.isRoundupByTitle(result.title)) {
            log(
              `[ScoopHunter] Skipping roundup by title: ${result.title}`,
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
   * Generate dynamic search queries based on current trends (Deep Dive Mode)
   */
  private async generateTrendQueries(dateFilter: string): Promise<string[]> {
    log("[ScoopHunter] identifying current trends for Deep Dive...", "agent");

    const prompt = `Identify 3-5 specific, fast-rising trends or major events in Artificial Intelligence from the last 7 days.
    Focus on:
    - Unexpected geopolitical AI news (e.g., China, EU, Middle East)
    - Specific company breakthroughs or crises NOT covered by generic searches
    - Niche but high-impact research
    - Cultural shifts or viral AI moments
    
    Exclude: Generic "AI is growing" or "AI in healthcare" broad topics. Focus on EVENTS.
    
    Return JSON:
    {
      "trends": [
        "Description of trend 1",
        "Description of trend 2"
      ],
      "searchQueries": [
        "Specific search query for trend 1",
        "Specific search query for trend 2"
      ]
    }`;

    try {
      const response = await geminiService.generateJSON<{
        trends: string[];
        searchQueries: string[];
      }>(prompt);

      log(`[ScoopHunter] Identified trends: ${response.trends.join(", ")}`, "agent");

      // Append date filter to dynamic queries
      return response.searchQueries.map(q => `${q} ${dateFilter}`);
    } catch (error) {
      log(`[ScoopHunter] Failed to generate trend queries: ${error}`, "agent");
      // Fallback to a generic "what happened in AI" query if generation fails
      return [`significant AI news events ${dateFilter}`, `unexpected AI breakthrough ${dateFilter}`];
    }
  }

  /**
   * Score relevance and generate summaries for candidates
   */
  private async scoreAndSummarize(candidates: Candidate[]): Promise<ScoredCandidate[]> {
    const scored: ScoredCandidate[] = [];

    for (const candidate of candidates) {
      try {
        const prompt = `Analyze this AI news story for Hello Jumble, a newsletter that writes SINGLE-TOPIC stories with narrative headlines.

Title: ${candidate.title}
Snippet: ${candidate.snippet}
Source: ${candidate.source}

HELLO JUMBLE HEADLINE EXAMPLES (this is their actual style):
- "Sam Altman Gets Upset When Asked About Valuation" (drama/personality)
- "Apple Finally Admits It Needs Help" (narrative tension)
- "AI Slop Is Rapidly Taking Over YouTube Feeds" (cultural impact)
- "xAI Takes Apple and OpenAI to Court for Unlawful Collusion" (conflict/legal)
- "Gemini 3 Deep Think Finally Released" (specific product)
- "China Sets the World's Strictest Chatbot Regulations" (policy)
- "Tinder Uses Your Photos to Make Better Matches" (consumer app)
- "NASA Spots Potential Signs of Martian Life With the Help of AI" (real-world application)

SCORING CRITERIA (0-100):
HIGH SCORE (80-100):
- Single specific story with narrative potential
- Major company: OpenAI, Anthropic, Google, Meta, Apple, xAI, Amazon
- Drama, conflict, or human interest angle
- Consumer/cultural impact
- Breaking product release or major update

LOW SCORE (0-40):
- Roundup articles ("5 AI tools...", "This week in AI...", "AI news roundup")
- Generic listicles, "best of", or comparison articles
- Old news (more than 1 week old)
- Technical tutorials or how-to content
- Press releases without news value

AUTOMATIC REJECT (score 0):
- Articles that cover MULTIPLE unrelated AI stories
- "Weekly digest" or "news roundup" format

Write a 1-2 sentence summary focusing on what makes this story newsworthy.

Return JSON:
{
  "relevanceScore": number (0-100),
  "summary": "string (1-2 sentences)",
  "reasoning": "Brief explanation",
  "isRoundup": boolean
}`;

        const response = await geminiService.generateJSON<{
          relevanceScore: number;
          summary: string;
          reasoning: string;
          isRoundup: boolean;
        }>(prompt);

        // Skip roundup articles entirely
        if (response.isRoundup) {
          log(
            `[ScoopHunter] Skipping roundup: "${candidate.title}"`,
            "agent"
          );
          continue;
        }

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
