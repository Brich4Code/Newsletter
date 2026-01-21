import { scoopHunterAgent } from "../agents/scoophunter";
import { challengeGeneratorAgent } from "../agents/challenge-generator";
import { log } from "../index";

/**
 * Research Orchestrator
 * Runs background loop to continuously populate database with fresh leads
 * Runs every N hours (configurable via RESEARCH_INTERVAL_HOURS)
 */
export class ResearchOrchestrator {
  private intervalHours: number;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  constructor() {
    this.intervalHours = parseInt(process.env.RESEARCH_INTERVAL_HOURS || "6");
  }

  /**
   * Start the background research loop
   * Note: Only used if you want continuous background research
   */
  start(): void {
    log(
      `[Orchestrator] Background research loop available (manual trigger only)`,
      "orchestrator"
    );
    // No longer runs automatically - waiting for manual trigger
  }

  /**
   * Stop the research loop
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      log("[Orchestrator] Background research stopped", "orchestrator");
    }
  }

  /**
   * Run a single research cycle
   */
  async runCycle(mode: "standard" | "deep-dive" = "standard"): Promise<void> {
    if (this.isRunning) {
      log("[Orchestrator] Research cycle already running, skipping", "orchestrator");
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    log(`[Orchestrator] ━━━ Starting Research Cycle (${mode}) ━━━`, "orchestrator");

    try {
      // 1. Research new leads
      log("[Orchestrator] Phase 1: Searching for news...", "orchestrator");
      await scoopHunterAgent.run(mode);

      // 2. Generate challenges (only on Mondays)
      if (this.shouldGenerateChallenges()) {
        log("[Orchestrator] Phase 2: Generating weekly challenges...", "orchestrator");
        await challengeGeneratorAgent.run();
      } else {
        log("[Orchestrator] Skipping challenge generation (not Monday)", "orchestrator");
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      log(
        `[Orchestrator] ✓ Research cycle complete (${duration}s)`,
        "orchestrator"
      );
    } catch (error) {
      log(`[Orchestrator] ✗ Research cycle failed: ${error}`, "orchestrator");
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Check if we should generate new challenges
   * Only run on Mondays
   */
  private shouldGenerateChallenges(): boolean {
    const today = new Date();
    return today.getDay() === 1; // Monday
  }

  /**
   * Manually trigger a research cycle (for testing/admin)
   */
  async triggerManualCycle(mode: "standard" | "deep-dive" = "standard"): Promise<void> {
    log(`[Orchestrator] Manual research cycle triggered (${mode})`, "orchestrator");
    await this.runCycle(mode);
  }
}

// Singleton instance
export const researchOrchestrator = new ResearchOrchestrator();
