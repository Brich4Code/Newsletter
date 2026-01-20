import fs from "fs";
import path from "path";

/**
 * Hello Jumble Newsletter Style Guide
 * Reads rules from newsletter-rules.md
 */

// Read the rules from the markdown file
const rulesPath = path.resolve(process.cwd(), "server/config/newsletter-rules.md");
let rulesContent = "";
try {
  rulesContent = fs.readFileSync(rulesPath, "utf-8");
} catch (error) {
  console.error("Failed to read newsletter rules:", error);
  rulesContent = "Error loading newsletter rules.";
}

export const NewsletterStyleGuide = {
  rules: rulesContent
};

// Export types if needed by other modules, otherwise can be removed.
// Keeping for safety as removing exports can break imports.
export type NewsletterSection = {
  name: string;
  required: boolean;
};

export type ValidationResult = {
  valid: boolean;
  violations: string[];
};

