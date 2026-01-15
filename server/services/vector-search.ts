import { db } from "../db";
import { sql } from "drizzle-orm";
import { newsletterHistory } from "@shared/schema";
import { geminiService } from "./gemini";
import { log } from "../index";

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  matchType?: "exact_url" | "semantic_similarity";
  matchedTitle?: string;
  similarity?: number;
}

/**
 * Service for vector-based semantic search and deduplication
 * Uses text-embedding-004 (768 dimensions) for embeddings
 */
export class VectorSearchService {
  private readonly SIMILARITY_THRESHOLD = 0.85; // 85% similarity = duplicate

  /**
   * Check if a story is a duplicate (by URL or semantic similarity)
   */
  async checkDuplicate(url: string, title: string): Promise<DuplicateCheckResult> {
    try {
      // 1. Check for exact URL match
      const urlMatch = await db
        .select()
        .from(newsletterHistory)
        .where(sql`${newsletterHistory.url} = ${url}`)
        .limit(1);

      if (urlMatch.length > 0) {
        log(`[VectorSearch] Exact URL match found: ${url}`, "vector");
        return {
          isDuplicate: true,
          matchType: "exact_url",
          matchedTitle: urlMatch[0].title,
        };
      }

      // 2. Generate embedding for title
      const embedding = await geminiService.embed(title);

      // 3. Semantic search with cosine similarity
      // Using pgvector extension: 1 - (embedding <=> query) = similarity
      const similarStories = await db.execute(sql`
        SELECT
          url,
          title,
          1 - (embedding <=> ${sql`[${embedding.join(",")}]`}::vector) as similarity
        FROM newsletter_history
        WHERE embedding IS NOT NULL
          AND 1 - (embedding <=> ${sql`[${embedding.join(",")}]`}::vector) > ${this.SIMILARITY_THRESHOLD}
        ORDER BY similarity DESC
        LIMIT 1
      `);

      if (similarStories.rows.length > 0) {
        const match = similarStories.rows[0] as any;
        log(
          `[VectorSearch] Semantic match found: "${match.title}" (${Math.round(match.similarity * 100)}% similar)`,
          "vector"
        );
        return {
          isDuplicate: true,
          matchType: "semantic_similarity",
          matchedTitle: match.title,
          similarity: match.similarity,
        };
      }

      // Not a duplicate
      return { isDuplicate: false };
    } catch (error) {
      log(`[VectorSearch] Error checking duplicate: ${error}`, "vector");
      // On error, assume not duplicate (fail open)
      return { isDuplicate: false };
    }
  }

  /**
   * Add a story to history (for future deduplication)
   */
  async addToHistory(url: string, title: string): Promise<void> {
    try {
      const embedding = await geminiService.embed(title);

      await db.insert(newsletterHistory).values({
        url,
        title,
        embedding: sql`[${embedding.join(",")}]::vector`,
      });

      log(`[VectorSearch] Added to history: ${title}`, "vector");
    } catch (error) {
      log(`[VectorSearch] Error adding to history: ${error}`, "vector");
      // Don't throw - history tracking is not critical
    }
  }

  /**
   * Find semantically similar stories in history
   * Useful for finding related content
   */
  async findSimilar(title: string, limit: number = 5): Promise<Array<{
    url: string;
    title: string;
    similarity: number;
  }>> {
    try {
      const embedding = await geminiService.embed(title);

      const results = await db.execute(sql`
        SELECT
          url,
          title,
          1 - (embedding <=> ${sql`[${embedding.join(",")}]`}::vector) as similarity
        FROM newsletter_history
        WHERE embedding IS NOT NULL
        ORDER BY similarity DESC
        LIMIT ${limit}
      `);

      return results.rows.map((row: any) => ({
        url: row.url,
        title: row.title,
        similarity: row.similarity,
      }));
    } catch (error) {
      log(`[VectorSearch] Error finding similar: ${error}`, "vector");
      return [];
    }
  }

  /**
   * Clean up old history entries (older than 90 days)
   * Run periodically to keep database size manageable
   */
  async cleanupOldHistory(daysToKeep: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = await db
        .delete(newsletterHistory)
        .where(sql`${newsletterHistory.publishedAt} < ${cutoffDate}`)
        .returning({ id: newsletterHistory.id });

      const deletedCount = result.length;
      log(`[VectorSearch] Cleaned up ${deletedCount} old history entries`, "vector");
      return deletedCount;
    } catch (error) {
      log(`[VectorSearch] Error cleaning history: ${error}`, "vector");
      return 0;
    }
  }
}

// Singleton instance
export const vectorSearchService = new VectorSearchService();
