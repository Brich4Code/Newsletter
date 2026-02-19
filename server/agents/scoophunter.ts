import { geminiService } from "../services/gemini";
import { perplexityService } from "../services/perplexity";
import { vectorSearchService } from "../services/vector-search";
import { hackerNewsService } from "../services/hackernews";
import { storage } from "../storage";
import { log } from "../index";
import type { ProgressCallback } from "../orchestrator/research-loop";

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
 * Run items through an async function in concurrency-limited batches
 */
async function runInBatches<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
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

  async run(
    mode: "standard" | "deep-dive" | "monthly" | "breaking" = "standard",
    onProgress?: ProgressCallback
  ): Promise<void> {
    const progress = onProgress || (() => {});
    log(`[ScoopHunter] Starting research cycle in ${mode} mode...`, "agent");

    try {
      // Calculate date filter based on mode
      const today = new Date();
      let daysBack = 7;
      if (mode === "monthly") daysBack = 30;
      else if (mode === "breaking") daysBack = 2;

      const startDate = new Date(today);
      startDate.setDate(today.getDate() - daysBack);
      const dateFilter = `after:${startDate.toISOString().split('T')[0]}`;

      let searchQueries: string[] = [];

      if (mode === "standard") {
        // Standard Mode: Use predefined topics with strict date filtering (7 days)
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
          // Open Source & Developer Tools (NEW)
          `AI GitHub trending OR viral AI project`,
          `AI open source release OR announcement`,
          `AI developer tool launch`,
          // International/Emerging Players (moved from monthly)
          `Alibaba AI OR Qwen OR DeepSeek news`,
          `AI China OR European AI news`,
          // Community Viral Signals (NEW)
          `AI viral Twitter OR Reddit discussion`,
          `AI Hacker News top story`,
          // Model Releases - Broader (NEW)
          `new AI model released OR announced`,
          `LLM launch OR language model release`,
        ];

        searchQueries = baseTopics.map(topic => `${topic} ${dateFilter}`);
      } else if (mode === "breaking") {
        // Breaking Mode: Last 48 hours with aggressive recency terms
        const breakingTopics = [
          // Use more urgent/recent language
          `OpenAI announcement OR release today`,
          `Anthropic Claude latest OR breaking`,
          `Google Gemini just released OR announced`,
          `Meta AI breaking news OR just announced`,
          `ChatGPT new feature OR update announced`,
          `AI breakthrough OR major discovery`,
          `AI viral OR trending now`,
          `GitHub trending AI project`,
          `Hacker News AI discussion`,
          `new AI model just released`,
          `Sam Altman OR Elon Musk latest`,
          `AI controversy OR drama breaking`,
          `Qwen OR DeepSeek latest news`,
          `AI company acquisition OR funding`,
        ];

        searchQueries = breakingTopics.map(topic => `${topic} ${dateFilter}`);
      } else if (mode === "monthly") {
        // Monthly Mode: Comprehensive search with expanded topics (last 30 days)
        const monthlyTopics = [
          // Major company news (same as standard)
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

          // === GLOBAL AI NEWS ===
          `AI news China OR Europe OR Asia`,
          `DeepSeek OR Baidu AI OR Mistral AI news`,
          `AI startup international OR global`,
          `AI summit OR international AI agreement OR policy`,

          // === SCIENCE ===
          `AI scientific discovery OR breakthrough`,
          `AI research paper OR study published`,
          `AI climate OR environment OR space exploration`,
          `AI physics OR biology OR chemistry discovery`,

          // === HEALTH ===
          `AI healthcare OR medical diagnosis`,
          `AI drug discovery OR pharmaceutical`,
          `AI mental health OR therapy`,
          `AI medical imaging OR radiology`,
        ];

        searchQueries = monthlyTopics.map(topic => `${topic} ${dateFilter}`);
      } else {
        // Deep Dive Mode: specific dynamic queries
        searchQueries = await this.generateTrendQueries(dateFilter);
      }

      progress({
        phase: "searching",
        totalQueries: searchQueries.length,
        completedQueries: 0,
      });

      // ===== SEARCH PHASE: Run queries in parallel batches of 5 =====
      const seenUrls = new Set<string>();
      let completedQueries = 0;

      const rawResultsByQuery = await runInBatches(searchQueries, 5, async (query) => {
        log(`[ScoopHunter] Searching: ${query}`, "agent");
        try {
          const results = await geminiService.searchGrounded(query);
          completedQueries++;
          progress({ completedQueries });
          return results;
        } catch (error) {
          log(`[ScoopHunter] Search failed for query: ${error}`, "agent");
          completedQueries++;
          progress({ completedQueries });
          return [];
        }
      });

      // Flatten all raw results
      const allRawResults: Array<{ title: string; url: string; snippet: string }> = [];
      for (const results of rawResultsByQuery) {
        for (const result of results) {
          const cleanedUrl = this.cleanUrl(result.url);
          if (seenUrls.has(cleanedUrl)) continue;
          seenUrls.add(cleanedUrl);
          allRawResults.push(result);
        }
      }

      log(`[ScoopHunter] Search phase complete: ${allRawResults.length} unique raw results from ${searchQueries.length} queries`, "agent");

      // ===== DEDUP PHASE: Check duplicates in parallel batches of 5 =====
      progress({ phase: "deduplicating" });

      const dedupResults = await runInBatches(allRawResults, 5, async (result) => {
        try {
          const duplicateCheck = await vectorSearchService.checkDuplicate(
            result.url,
            result.title
          );

          if (duplicateCheck.isDuplicate) {
            log(
              `[ScoopHunter] Skipping duplicate: ${result.title} (${duplicateCheck.matchType})`,
              "agent"
            );
            return null;
          }

          // Quick filter: Skip obvious roundup articles by title
          if (this.isRoundupByTitle(result.title)) {
            log(
              `[ScoopHunter] Skipping roundup by title: ${result.title}`,
              "agent"
            );
            return null;
          }

          const source = this.extractSource(result.url);

          return {
            title: result.title,
            url: this.cleanUrl(result.url),
            snippet: result.snippet,
            source,
          } as Candidate;
        } catch (error) {
          log(`[ScoopHunter] Dedup check failed: ${error}`, "agent");
          return null;
        }
      });

      const allCandidates: Candidate[] = dedupResults.filter(
        (c): c is Candidate => c !== null
      );

      // Fetch from Hacker News for additional coverage (all modes)
      log("[ScoopHunter] Fetching trending AI stories from Hacker News...", "agent");
      progress({ phase: "fetching Hacker News" });
      try {
        const hoursBack = mode === "breaking" ? 48 : mode === "monthly" ? 168 : 48; // 48h for breaking/standard, 7 days for monthly
        const minScore = mode === "monthly" ? 75 : 100; // Lower threshold for monthly
        const hnStories = await hackerNewsService.getRecentAIStories(hoursBack, minScore);

        log(`[ScoopHunter] Found ${hnStories.length} HN stories`, "agent");

        // Dedup HN stories in parallel batches too
        const hnDedupResults = await runInBatches(hnStories, 5, async (story) => {
          if (!story.url || seenUrls.has(this.cleanUrl(story.url))) return null;
          seenUrls.add(this.cleanUrl(story.url));

          try {
            const duplicateCheck = await vectorSearchService.checkDuplicate(
              story.url,
              story.title
            );
            if (duplicateCheck.isDuplicate) return null;
            if (this.isRoundupByTitle(story.title)) return null;

            const source = this.extractSource(story.url);

            return {
              title: story.title,
              url: this.cleanUrl(story.url),
              snippet: `${story.score} points on Hacker News with ${story.descendants || 0} comments`,
              source: `${source} (HN)`,
            } as Candidate;
          } catch {
            return null;
          }
        });

        allCandidates.push(
          ...hnDedupResults.filter((c): c is Candidate => c !== null)
        );
      } catch (error) {
        log(`[ScoopHunter] HN fetch failed: ${error}`, "agent");
      }

      progress({ candidatesFound: allCandidates.length });

      if (allCandidates.length === 0) {
        log("[ScoopHunter] No new candidates found", "agent");
        progress({ phase: "done", leadsStored: 0 });
        return;
      }

      log(`[ScoopHunter] Found ${allCandidates.length} unique candidates (including HN)`, "agent");

      // ===== SCORING PHASE: Score in parallel batches of 5 =====
      progress({ phase: "scoring" });

      const scoredCandidates = await this.scoreAndSummarize(allCandidates);

      // ===== SAVING PHASE: Store leads sequentially =====
      progress({ phase: "saving" });

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

      progress({ phase: "done", leadsStored: storedCount });
      log(`[ScoopHunter] Research complete. Stored ${storedCount} new leads.`, "agent");
    } catch (error) {
      log(`[ScoopHunter] Error: ${error}`, "agent");
      throw error;
    }
  }

  /**
   * Generate dynamic search queries based on current trends (Deep Dive Mode)
   */
  /**
   * Generate dynamic search queries based on current trends (Deep Dive Mode)
   * Uses Perplexity for real-time discovery, then Gemini for query formatting
   */
  private async generateTrendQueries(dateFilter: string): Promise<string[]> {
    log("[ScoopHunter] Identifying current trends for Deep Dive via Perplexity...", "agent");
    const today = new Date().toISOString().split('T')[0];

    // Step 1: Get raw trend info from Perplexity (Live Web Search)
    // We explicitly ask for "fresh" news to avoid 2024 hallucinations
    const perplexityPrompt = `List 5 specific, fast-rising AI trends or major news events from the LAST 7 DAYS (Today is ${today}).
    Focus on:
    - Unexpected geopolitical AI news (e.g., China, EU, Middle East)
    - Specific company breakthroughs (DeepSeek, OpenAI, Anthropic, etc.)
    - Niche but high-impact research
    - Cultural shifts or viral AI moments

    Give concrete details, names, and dates.
    DO NOT list generic trends like "AI in healthcare". Give me ACTUAL NEWS EVENTS.`;

    let trendContext = "";
    try {
      const perplexityResult = await perplexityService.research(perplexityPrompt);
      trendContext = perplexityResult.answer;
      log(`[ScoopHunter] Perplexity found trends: ${trendContext.substring(0, 200)}...`, "agent");
    } catch (e) {
      log(`[ScoopHunter] Perplexity trend search failed: ${e}`, "agent");
      // Fallback if Perplexity fails: use a generic broad search query for Gemini Grounded
      return [`significant AI news events ${dateFilter}`, `unexpected AI breakthrough ${dateFilter}`];
    }

    // Step 2: Parser Perplexity's context into clean search queries
    const parsingPrompt = `You are a search query generator.
    Based on the following REAL-TIME news summary, generate 3-5 targeted Google search queries to find full articles.

    NEWS SUMMARY (Source: Perplexity Live Search):
    ${trendContext}

    TODAY'S DATE: ${today}

    Return JSON:
    {
      "trends": [
        "Description of trend 1",
        "Description of trend 2"
      ],
      "searchQueries": [
        "Specific search query matching the trend",
        "Another specific query"
      ]
    }`;

    try {
      const response = await geminiService.generateJSON<{
        trends: string[];
        searchQueries: string[];
      }>(parsingPrompt);

      log(`[ScoopHunter] Identified trends: ${response.trends.join(", ")}`, "agent");

      // Append date filter to dynamic queries
      return response.searchQueries.map(q => `${q} ${dateFilter}`);
    } catch (error) {
      log(`[ScoopHunter] Failed to generate json queries from trend context: ${error}`, "agent");
      // Fallback
      return [`recent AI news ${dateFilter}`];
    }
  }

  /**
   * Score relevance and generate summaries for candidates
   * Now runs scoring in parallel batches of 5
   */
  private async scoreAndSummarize(candidates: Candidate[]): Promise<ScoredCandidate[]> {
    const results = await runInBatches(candidates, 5, async (candidate) => {
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
          return null;
        }

        log(
          `[ScoopHunter] Scored: "${candidate.title}" = ${response.relevanceScore}/100`,
          "agent"
        );

        return {
          ...candidate,
          summary: response.summary,
          relevanceScore: Math.round(response.relevanceScore),
        } as ScoredCandidate;
      } catch (error) {
        log(`[ScoopHunter] Failed to score candidate: ${error}`, "agent");
        return null;
      }
    });

    return results
      .filter((c): c is ScoredCandidate => c !== null)
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
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
