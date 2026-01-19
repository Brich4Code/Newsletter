import { investigatorAgent } from "../agents/investigator";
import { writerAgent } from "../agents/writer";
import { complianceOfficerAgent } from "../agents/compliance-officer";
import { illustratorAgent } from "../agents/illustrator";
import { googleDocsService } from "../services/google-docs";
import { storage } from "../storage";
import { log } from "../index";
import type { Issue, Lead, Challenge } from "@shared/schema";

export interface PublicationResult {
  success: boolean;
  googleDocsUrl: string | null;
  error?: string;
  warnings?: string[];
}

/**
 * Publication Pipeline
 * Orchestrates the full workflow from selected stories to published Google Doc
 *
 * Flow:
 * 1. Fetch all story data
 * 2. Fact-check main story
 * 3. Generate newsletter draft (Writer)
 * 4. Validate compliance (up to 3 attempts)
 * 5. Generate hero image
 * 6. Create Google Doc with formatting
 * 7. Return Google Docs URL
 */
export class PublicationPipeline {
  private readonly MAX_COMPLIANCE_ATTEMPTS = 3;

  async execute(issue: Issue): Promise<PublicationResult> {
    const startTime = Date.now();
    log(`[Pipeline] ━━━ Starting Publication for Issue #${issue.issueNumber} ━━━`, "pipeline");

    const warnings: string[] = [];

    try {
      // Phase 1: Fetch all content
      log("[Pipeline] Phase 1: Fetching content...", "pipeline");
      const content = await this.fetchContent(issue);

      if (!content.mainStory) {
        throw new Error("Main story not found");
      }

      // Phase 2: Fact-check main story (non-blocking - warnings only)
      log("[Pipeline] Phase 2: Fact-checking main story...", "pipeline");
      try {
        const factCheck = await investigatorAgent.verifyStory(content.mainStory);

        if (factCheck.status === "failed") {
          warnings.push(`Fact-check warning: ${factCheck.issues.join(", ")}`);
          log(`[Pipeline] Fact-check warning (continuing anyway): ${factCheck.issues.join(", ")}`, "pipeline");
        } else if (factCheck.status === "warning") {
          warnings.push(...factCheck.issues);
        }

        // Update lead with primary source if found
        if (factCheck.primarySourceUrl && factCheck.primarySourceUrl !== content.mainStory.url) {
          content.mainStory.primarySourceUrl = factCheck.primarySourceUrl;
        }
      } catch (factCheckError) {
        warnings.push(`Fact-check skipped: ${factCheckError}`);
        log(`[Pipeline] Fact-check failed, continuing anyway: ${factCheckError}`, "pipeline");
      }

      // Phase 3: Generate newsletter draft
      log("[Pipeline] Phase 3: Writing newsletter...", "pipeline");
      let draft = await writerAgent.generateNewsletter(content, issue.issueNumber);

      // Phase 4: Compliance validation (with auto-fix attempts)
      log("[Pipeline] Phase 4: Validating compliance...", "pipeline");
      let validation = await complianceOfficerAgent.validate(draft);
      let attempts = 0;

      while (!validation.valid && attempts < this.MAX_COMPLIANCE_ATTEMPTS) {
        attempts++;
        log(
          `[Pipeline] Compliance violations found (attempt ${attempts}/${this.MAX_COMPLIANCE_ATTEMPTS})`,
          "pipeline"
        );
        log(`[Pipeline] Violations: ${validation.violations.join("; ")}`, "pipeline");

        // Auto-fix violations
        draft = await complianceOfficerAgent.fix(draft, validation.violations);

        // Re-validate
        validation = await complianceOfficerAgent.validate(draft);
      }

      if (!validation.valid) {
        throw new Error(
          `Could not fix compliance violations after ${this.MAX_COMPLIANCE_ATTEMPTS} attempts: ${validation.violations.join(", ")}`
        );
      }

      // Final quality check
      const finalCheck = await complianceOfficerAgent.finalCheck(draft);
      if (!finalCheck.passed) {
        warnings.push(...finalCheck.issues);
        log(`[Pipeline] Quality warnings: ${finalCheck.issues.join("; ")}`, "pipeline");
      }

      log("[Pipeline] ✓ Compliance validation passed", "pipeline");

      // Phase 5: Generate hero image
      log("[Pipeline] Phase 5: Generating hero image...", "pipeline");
      const heroImageUrl = await illustratorAgent.generateHeroImage(content.mainStory);

      if (!heroImageUrl) {
        warnings.push("Hero image generation not available (placeholder)");
      }

      // Phase 6: Create Google Doc
      log("[Pipeline] Phase 6: Creating Google Doc...", "pipeline");
      const googleDocsUrl = await googleDocsService.createNewsletterDocument({
        markdown: draft,
        heroImageUrl: heroImageUrl || undefined,
        issueNumber: issue.issueNumber,
      });

      // Phase 7: Update issue record with Google Docs URL
      await storage.updateIssue(issue.id, { googleDocsUrl });

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      log(
        `[Pipeline] ✓ Publication complete (${duration}s): ${googleDocsUrl}`,
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
   * Fetch all content for the issue
   */
  private async fetchContent(issue: Issue) {
    const mainStory = issue.mainStoryId
      ? await storage.getLeadById(issue.mainStoryId)
      : null;

    const secondaryStory = issue.secondaryStoryId
      ? await storage.getLeadById(issue.secondaryStoryId)
      : null;

    const quickLinks: Lead[] = [];
    for (const id of issue.quickLinkIds) {
      const lead = await storage.getLeadById(id);
      if (lead) quickLinks.push(lead);
    }

    const challenge = issue.challengeId
      ? await storage.getChallengeById(issue.challengeId)
      : null;

    return {
      mainStory,
      secondaryStory,
      quickLinks,
      challenge,
    };
  }
}

// Singleton instance
export const publicationPipeline = new PublicationPipeline();
