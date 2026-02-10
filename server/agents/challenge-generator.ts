import { geminiService } from "../services/gemini";
import { storage } from "../storage";
import { log } from "../index";
import { perplexityService } from "../services/perplexity";

/**
 * Challenge Generator Agent
 * Creates weekly AI challenges for non-technical readers
 * Discovers trending and surprising AI tools, not just the usual suspects
 */
export class ChallengeGeneratorAgent {
  async run(): Promise<void> {
    log("[ChallengeGenerator] Creating weekly challenges...", "agent");

    try {
      const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

      // Discover trending and lesser-known AI tools — not just the big names
      log("[ChallengeGenerator] Discovering trending AI tools and apps...", "agent");
      const toolsResearch = await perplexityService.research(
        `What are the most interesting, fun, or surprisingly useful AI tools and apps people are talking about RIGHT NOW (${today})? ` +
        `Go beyond the obvious (ChatGPT, Claude, Gemini). Include:\n` +
        `- Trending new AI apps on Product Hunt, TikTok, or Twitter\n` +
        `- Creative AI tools (music, art, video, fashion, design)\n` +
        `- AI tools for everyday life (fitness, cooking, travel, dating, parenting, finance)\n` +
        `- Weird, fun, or viral AI experiments people are sharing\n` +
        `- AI tools that just launched or went viral this month\n` +
        `Also include 2-3 of the big names (ChatGPT, Claude, Gemini, etc.) but ONLY if they have a specific new feature worth trying.\n` +
        `For each tool, include its name and what makes it interesting right now.`
      );

      log(`[ChallengeGenerator] Tools discovered: ${toolsResearch.answer.substring(0, 200)}...`, "agent");

      const prompt = `Generate 5 weekly challenges for Hello Jumble, an AI newsletter for curious non-technical people.

TRENDING AI TOOLS RIGHT NOW:
${toolsResearch.answer}

OUR READERS: Not coders. They're curious people who want to try cool AI stuff that's fun, surprising, or genuinely improves their life. Think: teachers, marketers, parents, small business owners, creatives, students.

CHALLENGE RULES:
- Zero coding. Ever. If a tool requires code, skip it.
- Completable in 15-45 minutes
- Each challenge should use 1-2 AI tools MAX (not a toolchain of 5 apps)
- At least 2 of the 5 challenges should feature a tool most readers have probably NEVER heard of
- At least 1 challenge should be weird/playful/unexpected (not just "be more productive")
- Include 1-2 helpful links within the description (direct link to the tool, or a quick tutorial)
- Steps should feel like a friend explaining it, not a technical manual

CHALLENGE TYPES (pick the best fit):
- "creative" — make something cool (art, music, video, design, writing)
- "life_hack" — save time or improve daily life (health, money, planning, learning)
- "fun" — weird, playful, or just entertaining
- "self_improvement" — learn something, grow a skill, reflect

GREAT CHALLENGE EXAMPLES (this is the vibe):
- "Turn Your Shower Thoughts Into a Podcast" — Use NotebookLM to turn random voice memos into a polished 5-min podcast episode
- "AI Judge Your Spotify Wrapped" — Paste your top songs into ChatGPT and ask it to roast your music taste, then generate a playlist of what you SHOULD be listening to
- "Build Your Dream Vacation in 10 Minutes" — Use Layla AI to plan a full itinerary, then have Midjourney visualize your trip
- "Settle a Debate With AI" — Pick a silly argument you've had with a friend, present both sides to Claude, and see who AI thinks is right
- "Create a Children's Book in 30 Minutes" — Write a short story with ChatGPT, illustrate it with Ideogram, compile in Canva

BAD CHALLENGES (avoid these):
- "Summarize a PDF with AI" (boring, obvious)
- "Use ChatGPT to write an email" (everyone already does this)
- "Build an AI-powered workflow with Zapier" (too technical)
- "Compare outputs from 3 different LLMs" (too nerdy)
- Anything that reads like a tutorial or homework assignment

Return as JSON array:
[
  {
    "title": "Catchy challenge title (under 60 chars)",
    "description": "120-150 words. Friendly tone. Include 3-5 simple steps with emoji prefixes. Include 1-2 links to the tools mentioned.",
    "type": "creative | life_hack | fun | self_improvement"
  }
]`;

      const challenges = await geminiService.generateJSON<Array<{
        title: string;
        description: string;
        type: string;
      }>>(prompt);

      for (const challenge of challenges) {
        await storage.createChallenge({
          title: challenge.title,
          description: challenge.description,
          type: challenge.type,
        });

        log(`[ChallengeGenerator] Created: ${challenge.title}`, "agent");
      }

      log(`[ChallengeGenerator] Generated ${challenges.length} new challenges`, "agent");
    } catch (error) {
      log(`[ChallengeGenerator] Error: ${error}`, "agent");
      throw error;
    }
  }
}

// Singleton instance
export const challengeGeneratorAgent = new ChallengeGeneratorAgent();
