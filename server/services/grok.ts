import { log } from "../index";
import type { SearchResult } from "./gemini";

export interface TweetResult {
  author: string;
  handle: string;
  text: string;
  url: string;
}

export class GrokService {
  private apiKey: string | null = null;
  private baseUrl = "https://openrouter.ai/api/v1/chat/completions";
  private model = "x-ai/grok-4.20-beta";

  private initialize(): void {
    if (this.apiKey) return;

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error("OPENROUTER_API_KEY environment variable is not set.");
    }

    this.apiKey = apiKey;
    log("[Grok] Service initialized successfully", "grok");
  }

  async searchTweets(topic: string, count: number = 2): Promise<TweetResult[]> {
    this.initialize();

    try {
      log(`[Grok] Searching X for tweets about: ${topic}`, "grok");

      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://newsletter.jumble.ai",
          "X-Title": "Newsletter Tweet Research",
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: "user",
              content: `Search X (Twitter) for ${count} recent, highly relevant posts about this topic: "${topic}"

Requirements:
- Find real, recent posts (last 7 days preferred)
- Posts should be from notable accounts, journalists, industry figures, or viral threads
- Each post must have substantial engagement or come from a verified/notable account
- Prefer posts that add opinion, reaction, or insider info (not just resharing a link)

Return as JSON array:
[
  {
    "author": "Display Name",
    "handle": "username",
    "text": "The exact tweet text (truncate to 280 chars if needed)",
    "url": "https://x.com/username/status/123456789"
  }
]

Return ONLY the JSON array, no other text. Return exactly ${count} results.`,
            },
          ],
          temperature: 0.3,
          max_tokens: 2000,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Grok API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const answer = data.choices?.[0]?.message?.content || "";

      const jsonMatch = answer.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const tweets: TweetResult[] = JSON.parse(jsonMatch[0]);
        log(`[Grok] Found ${tweets.length} tweets`, "grok");
        return tweets.slice(0, count);
      }

      log("[Grok] No tweets found in response", "grok");
      return [];
    } catch (error) {
      log(`[Grok] Tweet search error: ${error}`, "grok");
      return [];
    }
  }

  async searchBreakingNews(queries: string[]): Promise<SearchResult[]> {
    this.initialize();

    try {
      log(`[Grok] Searching X for breaking news (${queries.length} queries)`, "grok");

      const queryList = queries.slice(0, 5).join(", ");

      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://newsletter.jumble.ai",
          "X-Title": "Newsletter Breaking News Research",
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: "user",
              content: `Search X (Twitter) for breaking AI news stories trending in the last 48 hours.

Topics to search: ${queryList}

Find stories that are:
- Breaking or trending on X right now
- From credible sources or widely discussed
- About specific events, launches, or controversies (not opinion pieces)

For each story found, provide:
- The headline/title
- A source URL (prefer the original article URL shared on X, not the tweet URL)
- A 1-2 sentence summary

Return as JSON array:
[
  {
    "title": "Story headline",
    "url": "https://source-website.com/article",
    "snippet": "Brief summary"
  }
]

Return ONLY the JSON array. Maximum 10 results.`,
            },
          ],
          temperature: 0.3,
          max_tokens: 3000,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Grok API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const answer = data.choices?.[0]?.message?.content || "";

      const jsonMatch = answer.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const results: SearchResult[] = JSON.parse(jsonMatch[0]);
        log(`[Grok] Found ${results.length} breaking news items`, "grok");
        return results.filter(r => r.url && r.title);
      }

      log("[Grok] No breaking news found in response", "grok");
      return [];
    } catch (error) {
      log(`[Grok] Breaking news search error: ${error}`, "grok");
      return [];
    }
  }
}

export const grokService = new GrokService();
