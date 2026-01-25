import { writerAgent, type SimpleIssueContent, type StoryTopic } from "../agents/writer";
import { illustratorAgent } from "../agents/illustrator";
import { googleDocsService } from "../services/google-docs";
import { draftService } from "../services/draft-service";
import { storage } from "../storage";
import { log } from "../index";
import type { Issue } from "@shared/schema";

export interface PublicationResult {
  success: boolean;
  googleDocsUrl: string | null;
  error?: string;
  warnings?: string[];
}

/**
 * Simplified Publication Pipeline
 * Leverages AI's native power for research, fact-checking, and writing
 *
 * NEW SIMPLIFIED FLOW:
 * 1. Fetch basic story info (title, URL)
 * 2. Convert to simple topics
 * 3. Generate newsletter (AI researches, fact-checks, and writes)
 * 4. Generate hero image
 * 5. Create Google Doc with formatting
 * 6. Return Google Docs URL
 *
 * REMOVED:
 * - Separate investigator fact-checking phase (AI does this during research)
 * - Separate compliance officer validation (AI follows style guide natively)
 * - Complex pre-fetched summaries (AI researches fresh sources)
 */
export class PublicationPipeline {
  async execute(issue: Issue): Promise<PublicationResult> {
    const startTime = Date.now();
    log(`[Pipeline] ━━━ Starting Simplified Publication for Issue #${issue.issueNumber} ━━━`, "pipeline");

    const warnings: string[] = [];

    try {
      // Phase 1: Fetch basic story info and convert to simple topics
      log("[Pipeline] Phase 1: Preparing story topics...", "pipeline");
      const content = await this.prepareSimpleContent(issue);

      if (!content.mainStory) {
        throw new Error("Main story not found");
      }

      // Phase 2: Generate newsletter (AI researches, fact-checks, and writes in one go)
      log("[Pipeline] Phase 2: Generating newsletter (AI researching and writing)...", "pipeline");
      const draft = await writerAgent.generateNewsletter(content, issue.issueNumber);

      // Phase 3: Generate hero image (non-blocking)
      log("[Pipeline] Phase 3: Generating hero image...", "pipeline");
      let heroImageUrl: string | null = null;
      try {
        // Get the main story data for hero image generation
        const mainStoryData = issue.mainStoryId
          ? await storage.getLeadById(issue.mainStoryId)
          : null;

        if (mainStoryData) {
          heroImageUrl = await illustratorAgent.generateHeroImage(mainStoryData);
        }

        if (!heroImageUrl) {
          warnings.push("Hero image generation not available (placeholder)");
        }
      } catch (imageError) {
        warnings.push(`Hero image skipped: ${imageError}`);
        log(`[Pipeline] Hero image failed, continuing anyway: ${imageError}`, "pipeline");
      }

      // Phase 4: Create Draft in Supabase (New Flow)
      log("[Pipeline] Phase 4: Saving draft to Supabase...", "pipeline");

      const savedDraft = await draftService.createDraft(
        issue.issueNumber,
        draft,
        issue.id
      );

      log(`[Pipeline] Draft saved with ID: ${savedDraft.id}`, "pipeline");

      /* 
      // LEGACY: Auto-create Google Doc
      // Now handled via manual "Publish" button in Editor
      
      const googleDocsUrl = await googleDocsService.createNewsletterDocument({
        markdown: draft,
        heroImageUrl: heroImageUrl || undefined,
        issueNumber: issue.issueNumber,
      });
      */

      const googleDocsUrl = null;

      // Phase 5: Update issue record
      // We might want to store draftId in issue, but issueId is in draft, so that's fine.

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      log(
        `[Pipeline] ✓ Draft generation complete (${duration}s). Ready for editing.`,
        "pipeline"
      );

      return {
        success: true,
        googleDocsUrl,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      log(`[Pipeline] ✗ Publication failed (${duration}s): ${error}`, "pipeline");

      return {
        success: false,
        googleDocsUrl: null,
        error: String(error),
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    }
  }

  /**
   * Prepare simple content (just titles and URLs)
   * AI will research and fact-check everything
   */
  private async prepareSimpleContent(issue: Issue): Promise<SimpleIssueContent> {
    // Fetch basic story data
    const mainStoryData = issue.mainStoryId
      ? await storage.getLeadById(issue.mainStoryId)
      : null;

    const secondaryStoryData = issue.secondaryStoryId
      ? await storage.getLeadById(issue.secondaryStoryId)
      : null;

    const quickLinkTopics: StoryTopic[] = [];
    for (const id of issue.quickLinkIds) {
      const lead = await storage.getLeadById(id);
      if (lead) {
        quickLinkTopics.push({
          title: lead.title,
          url: lead.url,
          note: lead.note || undefined,
        });
      }
    }

    const challengeData = issue.challengeId
      ? await storage.getChallengeById(issue.challengeId)
      : null;

    // Log notes for debugging
    if (mainStoryData?.note) {
      log(`[Pipeline] Main story has editorial note: "${mainStoryData.note}"`, "pipeline");
    }
    if (secondaryStoryData?.note) {
      log(`[Pipeline] Secondary story has editorial note: "${secondaryStoryData.note}"`, "pipeline");
    }
    for (const topic of quickLinkTopics) {
      if (topic.note) {
        log(`[Pipeline] Quick link "${topic.title}" has editorial note: "${topic.note}"`, "pipeline");
      }
    }

    // Convert to simple format
    return {
      mainStory: mainStoryData
        ? { title: mainStoryData.title, url: mainStoryData.url, note: mainStoryData.note || undefined }
        : { title: "AI News Update" }, // Fallback if main story missing
      secondaryStory: secondaryStoryData
        ? { title: secondaryStoryData.title, url: secondaryStoryData.url, note: secondaryStoryData.note || undefined }
        : undefined,
      quickLinks: quickLinkTopics.length > 0 ? quickLinkTopics : undefined,
      challenge: challengeData
        ? {
          title: challengeData.title,
          description: challengeData.description,
        }
        : undefined,
    };
  }
}

// Singleton instance
export const publicationPipeline = new PublicationPipeline();
