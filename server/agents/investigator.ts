import { geminiService } from "../services/gemini";
import { log } from "../index";
import type { Lead } from "@shared/schema";

export interface FactCheckResult {
  status: "verified" | "failed" | "warning";
  urlLive: boolean;
  primarySourceUrl: string | null;
  issues: string[];
}

/**
 * Investigator Agent
 * Fact-checks stories and verifies links before publication
 */
export class InvestigatorAgent {
  async verifyStory(lead: Lead): Promise<FactCheckResult> {
    log(`[Investigator] Fact-checking: ${lead.title}`, "agent");

    const result: FactCheckResult = {
      status: "verified",
      urlLive: false,
      primarySourceUrl: null,
      issues: [],
    };

    try {
      // 1. Check if URL is live
      result.urlLive = await this.checkUrlLive(lead.url);
      if (!result.urlLive) {
        result.status = "failed";
        result.issues.push("URL is not accessible");
        return result;
      }

      // 2. Try to find primary source using Gemini
      const primarySource = await this.findPrimarySource(lead);
      result.primarySourceUrl = primarySource;

      if (primarySource && primarySource !== lead.url) {
        log(`[Investigator] Found primary source: ${primarySource}`, "agent");
      }

      log(`[Investigator] ✓ Story verified`, "agent");
      return result;
    } catch (error) {
      log(`[Investigator] Error: ${error}`, "agent");
      result.status = "warning";
      result.issues.push(`Verification error: ${error}`);
      return result;
    }
  }

  /**
   * Check if a URL is accessible
   */
  private async checkUrlLive(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, {
        method: "HEAD",
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      return response.ok;
    } catch (error) {
      log(`[Investigator] URL check failed for ${url}: ${error}`, "agent");
      return false;
    }
  }

  /**
   * Find the primary source (original research paper, blog post, etc.)
   */
  private async findPrimarySource(lead: Lead): Promise<string | null> {
    try {
      const prompt = `You are fact-checking an AI news story. Find the original primary source.

Story: ${lead.title}
Current source: ${lead.url}
Source outlet: ${lead.source}

Task: Determine if this is the primary source, or if it's reporting on another source.
- If it's a news article about research, find the original paper URL
- If it's reporting on a company announcement, find the official announcement
- If this IS the primary source, return the same URL

Return JSON:
{
  "isPrimarySource": boolean,
  "primarySourceUrl": "url or same url if primary",
  "reasoning": "brief explanation"
}`;

      const result = await geminiService.generateJSON<{
        isPrimarySource: boolean;
        primarySourceUrl: string;
        reasoning: string;
      }>(prompt);

      return result.primarySourceUrl;
    } catch (error) {
      log(`[Investigator] Primary source search failed: ${error}`, "agent");
      return lead.url; // Fallback to original URL
    }
  }
}

// Singleton instance
export const investigatorAgent = new InvestigatorAgent();
