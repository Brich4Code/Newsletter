import fs from "fs";
import path from "path";

const rulesDir = path.resolve(process.cwd(), "server/config");

function loadRulesFile(filename: string): string {
  try {
    return fs.readFileSync(path.join(rulesDir, filename), "utf-8");
  } catch (error) {
    console.error(`Failed to read ${filename}:`, error);
    return `Error loading ${filename}.`;
  }
}

const jumbleRules = loadRulesFile("newsletter-rules.md");
const overclockedRules = loadRulesFile("newsletter-rules-overclocked.md");

export type NewsletterType = "jumble" | "overclocked";

export function getStyleGuideRules(type: NewsletterType = "jumble"): string {
  return type === "overclocked" ? overclockedRules : jumbleRules;
}

// Backward compatible export (defaults to jumble)
export const NewsletterStyleGuide = {
  rules: jumbleRules,
};

export type NewsletterSection = {
  name: string;
  required: boolean;
};

export type ValidationResult = {
  valid: boolean;
  violations: string[];
};
