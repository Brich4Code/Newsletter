/**
 * Hacker News API Service
 * Fetches trending AI stories from Hacker News
 * API Docs: https://github.com/HackerNews/API
 */

const HN_API_BASE = "https://hacker-news.firebaseio.com/v0";

export interface HNStory {
  id: number;
  title: string;
  url?: string;
  score: number;
  by: string;
  time: number;
  descendants?: number; // comment count
}

export class HackerNewsService {
  /**
   * Fetch top stories from Hacker News and filter for AI-related content
   */
  async getAIStories(minScore: number = 100, limit: number = 30): Promise<HNStory[]> {
    try {
      // 1. Get top story IDs
      const topStoriesResponse = await fetch(`${HN_API_BASE}/topstories.json`);
      if (!topStoriesResponse.ok) {
        throw new Error(`HN API error: ${topStoriesResponse.statusText}`);
      }
      const topStoryIds: number[] = await topStoriesResponse.json();

      // 2. Fetch details for first 'limit' stories
      const storyPromises = topStoryIds
        .slice(0, limit)
        .map((id) => this.getStory(id));

      const stories = await Promise.all(storyPromises);

      // 3. Filter for AI-related stories with minimum score
      const aiKeywords = [
        /\b(AI|ML|LLM|GPT|Claude|Gemini|ChatGPT|OpenAI|Anthropic|DeepMind|Mistral)\b/i,
        /\bArtificial Intelligence\b/i,
        /\bMachine Learning\b/i,
        /\bNeural Network\b/i,
        /\bDeep Learning\b/i,
        /\bLarge Language Model\b/i,
        /\b(Llama|Qwen|DeepSeek|Mistral)\b/i,
      ];

      const aiStories = stories.filter((story) => {
        if (!story || !story.title) return false;
        if (story.score < minScore) return false;

        return aiKeywords.some((keyword) => keyword.test(story.title));
      });

      return aiStories as HNStory[];
    } catch (error) {
      console.error("[HackerNews] Error fetching stories:", error);
      return [];
    }
  }

  /**
   * Fetch a single story by ID
   */
  private async getStory(id: number): Promise<HNStory | null> {
    try {
      const response = await fetch(`${HN_API_BASE}/item/${id}.json`);
      if (!response.ok) return null;

      const story: HNStory = await response.json();

      // Only return stories with URLs (not Ask HN, Show HN without links, etc.)
      if (story.url) {
        return story;
      }
      return null;
    } catch (error) {
      console.error(`[HackerNews] Error fetching story ${id}:`, error);
      return null;
    }
  }

  /**
   * Get recent stories (from last 24-48 hours)
   */
  async getRecentAIStories(hoursBack: number = 24, minScore: number = 50): Promise<HNStory[]> {
    const stories = await this.getAIStories(minScore, 100); // Fetch more stories for recency filter

    const cutoffTime = Math.floor(Date.now() / 1000) - (hoursBack * 60 * 60);

    return stories.filter((story) => story.time >= cutoffTime);
  }
}

export const hackerNewsService = new HackerNewsService();
