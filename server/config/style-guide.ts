/**
 * Hello Jumble Newsletter Style Guide
 * Last updated: 2025-08-15
 */

export const NewsletterStyleGuide = {
  // Core formatting rules
  rules: `
CRITICAL FORMATTING RULES:
1. No two-part headers and no punctuation in headers (no dashes, colons, commas)
2. Headers use Title Case
3. No em dashes and no unnecessary hyphens
4. Every fact must be recent and verified
5. Embed links over natural anchor text only - NEVER show bare URLs
6. No duplicate links - use each exact URL once across the newsletter
7. Strip tracking parameters (utm, ref, share) from all URLs
8. Prefer canonical URLs

LINK EMBEDDING STANDARD:
- Use natural noun phrase anchors of 3 to 9 words
- Do NOT lead with "According to"
- Only use explicit attribution when naming a person or entity that is the subject
- Link the first mention only
- Place anchors over claims or nouns, not over punctuation
- Do not include outlet names in anchors unless the outlet itself is the subject
- For videos or posts, use descriptive anchors like "the video report" or "the statement on X from Name"
- Prefer the publisher page over rehosted clips

HEADER RULES:
- All headers use Title Case
- No punctuation in headers
- One emoji per header or bullet line
- Each H1, H2, H3 must have distinct angles and not repeat words

BULLET RULES:
- "In this newsletter" bullets use sentence case with first word capitalized
- Do NOT reuse the same words or emojis that will appear later in H1, H2, or H3
- Capitalize proper nouns and acronyms

QUALITY REQUIREMENTS:
- Use sources from the requested timeframe only
- Prefer primary or top-tier outlets
- Cross-verify important statistics
- If a figure cannot be confidently confirmed, flag as unverified or omit
- No bare URLs (search for "http" or "www" to catch strays)
- Search for duplicate domains to avoid repeats
`,

  // Template structure
  template: {
    subjectLine: {
      minChars: 40,
      maxChars: 60,
      notes: "Clicky. Focused on main story. Different from Newsletter Title and H1.",
    },
    previewText: {
      minChars: 70,
      maxChars: 95,
      notes: "Tease the secondary story and one Weekly Scoop item.",
    },
    newsletterTitle: {
      maxChars: 60,
      notes: "A fresh angle on the main story. Not a repeat of Subject or H1.",
    },
    welcomeSection: {
      minWords: 45,
      maxWords: 70,
      format: "Highlight main and secondary stories. End with ⬇️",
    },
    inThisNewsletter: {
      format: "Exactly five bullets with emojis:\n1. Main story\n2. Secondary story\n3-4. Two Weekly Scoop items (renamed, short headlines)\n5. Weekly Challenge\nSentence case with first word capitalized.",
      rules: "Do not reuse the same words or emojis that will appear later in headers.",
    },
    mainStory: {
      format: "H1 with emoji (Title Case, single part)\nH2 adds distinct angle\nOne intro paragraph, then space for image\nBody with 2-3 H3s, each with emoji",
      targetWords: 400,
      requirements: "Embed reputable, recent sources. Add placeholders for posts or video when needed.",
    },
    secondaryStory: {
      format: "H2 with emoji\nOne intro paragraph\n1-2 H3s with emojis",
      targetWords: 350,
      requirements: "Same linking rules as main story.",
    },
    weeklyScoop: {
      title: "Weekly Scoop 📢",
      itemCount: 6,
      format: "Six headlines from specified date window.\nEach has emoji and single, unique link.\nUse varied, reputable outlets.\nInclude one YouTube or video link when relevant.\nDo not repeat items already used in main or secondary stories.",
    },
    weeklyChallenge: {
      format: "Unique and timely, tied to this issue",
      minWords: 150,
      maxWords: 200,
      requirements: "Clear steps or scoring",
    },
    wrapUp: {
      format: "Bold one to two lines inviting replies or opinions",
    },
  },

  // Section definitions
  sections: [
    { name: "Welcome to this week's edition of Jumble", required: true },
    { name: "In this newsletter", required: true },
    { name: "Main Story", required: true },
    { name: "Secondary Story", required: true },
    { name: "Weekly Scoop", required: true },
    { name: "Weekly Challenge", required: true },
    { name: "Wrap Up", required: true },
  ],

  // Compliance patterns (for validation)
  violations: {
    headersWithPunctuation: /^#{1,6}\s+[^:\n]*[:,-]/gm,
    bareUrls: /(?<!\()https?:\/\/[^\s\)]+(?!\))/g,
    emojisInText: /[\p{Emoji_Presentation}]/gu,
    clickHereLinks: /\[click here\]|\[read more\]|\[learn more\]/gi,
    duplicateLinks: (markdown: string) => {
      const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
      const urls = new Set<string>();
      const duplicates: string[] = [];
      let match;

      while ((match = linkRegex.exec(markdown)) !== null) {
        const url = match[2];
        if (urls.has(url)) {
          duplicates.push(url);
        } else {
          urls.add(url);
        }
      }

      return duplicates;
    },
    trackingParameters: /[?&](utm_|ref=|share=)/g,
  },

  // Example newsletter structure
  exampleStructure: `
Welcome to Jumble, your go-to source for AI news updates. This week ____. Plus, ____. Let's dive in ⬇️

In today's newsletter:
🎨 Headline story #1
🎲 Headline story #2
🍿 Scoop section headline #1
🫧 Scoop section headline #2
🎯 Weekly Challenge: Challenge name

# Headline Story #1
Headline story #1 intro

## What's Happening
Story here

# Headline Story #2
Headline story #2 intro

## The Details
Story here

## Weekly Scoop 📢
🦴 Headline with natural link anchor

💸 Headline with natural link anchor

🚀 Headline with natural link anchor

🫧 Headline with natural link anchor

📊 Headline with natural link anchor

🧒 Headline with natural link anchor

## 🎯 Weekly Challenge: Challenge Name
Challenge explanation

Here's what to do:

Challenge steps

____. See you next time! 🚀
`,
};

export type NewsletterSection = {
  name: string;
  required: boolean;
};

export type ValidationResult = {
  valid: boolean;
  violations: string[];
};
