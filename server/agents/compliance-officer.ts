import { geminiService } from "../services/gemini";
import { NewsletterStyleGuide } from "../config/style-guide";
import { log } from "../index";

export interface ValidationResult {
  valid: boolean;
  violations: string[];
}

/**
 * Compliance Officer Agent
 * Validates newsletter drafts against the Hello Jumble style guide
 * Catches formatting errors and rule violations
 */
export class ComplianceOfficerAgent {
  async validate(markdown: string): Promise<ValidationResult> {
    log("[Compliance] Validating newsletter draft...", "agent");

    const violations: string[] = [];

    // Rule 1: Check for headers with punctuation
    const headersWithPunctuation = markdown.match(/^#{1,6}\s+[^:\n]*[:,-]/gm);
    if (headersWithPunctuation) {
      violations.push(
        `Found ${headersWithPunctuation.length} headers with punctuation (colons, dashes, commas). Headers must have no punctuation.`
      );
    }

    // Rule 2: Check for bare URLs
    const bareUrls = markdown.match(/(?<!\()https?:\/\/[^\s\)]+(?!\))/g);
    if (bareUrls) {
      violations.push(
        `Found ${bareUrls.length} bare URLs. All URLs must be embedded as [text](url).`
      );
    }

    // Rule 3: Check for emojis in body text (not in headers/bullets)
    const lines = markdown.split("\n");
    const bodyLines = lines.filter(line => !line.match(/^#{1,6}\s/) && !line.match(/^[🎨🎲🍿🫧🎯🦴💸🚀📊🧒]/));
    const emojiPattern = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;
    const bodyWithEmojis = bodyLines.filter(line => emojiPattern.test(line));
    if (bodyWithEmojis.length > 0) {
      violations.push(
        `Found emojis in body text. Emojis are only allowed in headers and bullet points.`
      );
    }

    // Rule 4: Check for "click here" or "read more" links
    const clickHereLinks = markdown.match(/\[(click here|read more|learn more)\]/gi);
    if (clickHereLinks) {
      violations.push(
        `Found ${clickHereLinks.length} "click here" style links. Use natural 3-9 word phrases instead.`
      );
    }

    // Rule 5: Check for duplicate URLs
    const duplicateUrls = this.findDuplicateLinks(markdown);
    if (duplicateUrls.length > 0) {
      violations.push(
        `Found ${duplicateUrls.length} duplicate URLs. Each URL should appear only once: ${duplicateUrls.join(", ")}`
      );
    }

    // Rule 6: Check for tracking parameters in URLs
    const trackingParams = markdown.match(/[?&](utm_|ref=|share=)/g);
    if (trackingParams) {
      violations.push(
        `Found ${trackingParams.length} URLs with tracking parameters (utm_, ref=, share=). Remove all tracking parameters.`
      );
    }

    // Rule 7: Check if headers use # syntax
    if (!markdown.includes("#")) {
      violations.push("No headers found. Must use # for H1, ## for H2, ### for H3.");
    }

    // Rule 8: Check for "According to" at start of sentences
    const accordingTo = markdown.match(/\.\s*According to/gi);
    if (accordingTo && accordingTo.length > 2) {
      violations.push(
        `Found multiple instances of "According to" (${accordingTo.length}). Minimize explicit attribution.`
      );
    }

    const result: ValidationResult = {
      valid: violations.length === 0,
      violations,
    };

    if (result.valid) {
      log("[Compliance] ✓ Validation passed", "agent");
    } else {
      log(`[Compliance] ✗ Found ${violations.length} violations`, "agent");
      violations.forEach(v => log(`  - ${v}`, "agent"));
    }

    return result;
  }

  /**
   * Attempt to auto-fix violations using Gemini
   */
  async fix(markdown: string, violations: string[]): Promise<string> {
    log("[Compliance] Attempting to fix violations...", "agent");

    const prompt = `You are fixing a newsletter draft that has violated the style guide rules.

VIOLATIONS TO FIX:
${violations.map((v, i) => `${i + 1}. ${v}`).join("\n")}

STYLE GUIDE RULES:
${NewsletterStyleGuide.rules}

ORIGINAL DRAFT:
${markdown}

YOUR TASK:
Fix ALL the violations listed above while preserving the content and structure.

SPECIFIC FIXES NEEDED:
- Remove all punctuation from headers (colons, dashes, commas)
- Embed all bare URLs as [natural anchor text](url)
- Remove emojis from body text
- Replace "click here" links with natural 3-9 word phrases
- Remove duplicate URL links (keep only first occurrence)
- Strip tracking parameters (?utm_*, ?ref=, ?share=) from all URLs
- Replace "According to" with direct statements

Return ONLY the corrected Markdown. Do not add explanations or commentary.`;

    try {
      const fixedDraft = await geminiService.generateWithPro(prompt, {
        temperature: 0.5, // Lower temperature for more conservative fixes
        maxTokens: 8192,
      });

      log("[Compliance] Fixes applied", "agent");
      return fixedDraft;
    } catch (error) {
      log(`[Compliance] Fix failed: ${error}`, "agent");
      throw new Error(`Failed to fix violations: ${error}`);
    }
  }

  /**
   * Find duplicate URLs in markdown
   */
  private findDuplicateLinks(markdown: string): string[] {
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const urlCounts = new Map<string, number>();
    let match;

    while ((match = linkRegex.exec(markdown)) !== null) {
      const url = match[2];
      urlCounts.set(url, (urlCounts.get(url) || 0) + 1);
    }

    const duplicates: string[] = [];
    urlCounts.forEach((count, url) => {
      if (count > 1) {
        duplicates.push(url);
      }
    });

    return duplicates;
  }

  /**
   * Perform final quality check before publishing
   */
  async finalCheck(markdown: string): Promise<{ passed: boolean; issues: string[] }> {
    const issues: string[] = [];

    // Check word counts for main sections
    const mainStoryMatch = markdown.match(/# [^\n]+\n([\s\S]*?)(?=\n# |\n## Weekly Scoop|$)/);
    if (mainStoryMatch) {
      const wordCount = mainStoryMatch[1].split(/\s+/).length;
      if (wordCount < 300 || wordCount > 500) {
        issues.push(`Main story word count: ${wordCount} (target: 300-500 words)`);
      }
    }

    // Check for required sections
    const requiredSections = ["Welcome to Jumble", "In this newsletter", "Weekly Scoop", "Weekly Challenge"];
    for (const section of requiredSections) {
      if (!markdown.toLowerCase().includes(section.toLowerCase())) {
        issues.push(`Missing required section: ${section}`);
      }
    }

    // Check that "In this newsletter" has exactly 5 bullets
    const inThisNewsletter = markdown.match(/In this newsletter[:\s]*([\s\S]*?)(?=\n#|$)/i);
    if (inThisNewsletter) {
      const bullets = inThisNewsletter[1].match(/^[🎨🎲🍿🫧🎯]/gm);
      if (!bullets || bullets.length !== 5) {
        issues.push(`"In this newsletter" should have exactly 5 bullets (found: ${bullets?.length || 0})`);
      }
    }

    return {
      passed: issues.length === 0,
      issues,
    };
  }
}

// Singleton instance
export const complianceOfficerAgent = new ComplianceOfficerAgent();
