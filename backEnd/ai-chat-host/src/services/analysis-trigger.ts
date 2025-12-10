import { MessageWindow } from '../models/message-window';
import { RoomAnalysisState, RoomAnalysisStateDoc } from '../models/room-analysis-state';
import { ANALYSIS_CONFIG } from '../config/constants';

export class AnalysisTrigger {
  /**
   * Check if analysis should be triggered for a room
   */
  async shouldAnalyze(window: MessageWindow, state: RoomAnalysisStateDoc | null): Promise<boolean> {
    // Check cooldown first
    if (await this.checkCooldown(state)) {
      console.log(`[AnalysisTrigger] Analysis skipped for room ${window.roomId} - cooldown active`);
      return false;
    }

    // Check time threshold
    const timeThresholdMet = await this.checkTimeThreshold(window);
    if (timeThresholdMet) {
      console.log(`[AnalysisTrigger] Time threshold met for room ${window.roomId}`);
      return true;
    }

    // Check message threshold
    const messageThresholdMet = await this.checkMessageThreshold(window, state);
    if (messageThresholdMet) {
      console.log(`[AnalysisTrigger] Message threshold met for room ${window.roomId}`);
      return true;
    }

    return false;
  }

  /**
   * Check if time threshold is met (e.g., 30 seconds since last message)
   */
  private async checkTimeThreshold(window: MessageWindow): Promise<boolean> {
    if (window.messages.length === 0) {
      return false;
    }

    const timeSinceLastMessage = Date.now() - window.lastMessageAt.getTime();
    return timeSinceLastMessage >= ANALYSIS_CONFIG.TIME_THRESHOLD_MS;
  }

  /**
   * Check if message threshold is met (e.g., 5 new messages since last analysis)
   */
  private async checkMessageThreshold(
    window: MessageWindow,
    state: RoomAnalysisStateDoc | null
  ): Promise<boolean> {
    if (!state || !state.lastAnalysisAt) {
      // No previous analysis - check if we have enough messages
      return window.messages.length >= ANALYSIS_CONFIG.MESSAGE_THRESHOLD;
    }

    // Count messages since last analysis
    const lastAnalysisTime = state.lastAnalysisAt.getTime();
    const newMessagesCount = window.messages.filter(
      m => m.createdAt.getTime() > lastAnalysisTime
    ).length;

    return newMessagesCount >= ANALYSIS_CONFIG.MESSAGE_THRESHOLD;
  }

  /**
   * Check if room is in cooldown period
   */
  private async checkCooldown(state: RoomAnalysisStateDoc | null): Promise<boolean> {
    if (!state || !state.cooldownUntil) {
      return false;
    }

    const now = new Date();
    return state.cooldownUntil > now;
  }

  /**
   * Set cooldown for a room
   */
  async setCooldown(roomId: string, state: RoomAnalysisStateDoc | null): Promise<void> {
    const cooldownUntil = new Date(Date.now() + ANALYSIS_CONFIG.MIN_COOLDOWN_MS);
    
    if (state) {
      state.cooldownUntil = cooldownUntil;
      await state.save();
    } else {
      const newState = RoomAnalysisState.build({
        roomId,
        cooldownUntil,
      });
      await newState.save();
    }

    console.log(`[AnalysisTrigger] Set cooldown for room ${roomId} until ${cooldownUntil.toISOString()}`);
  }

  /**
   * Check rate limiting (max analyses per hour)
   */
  async checkRateLimit(state: RoomAnalysisStateDoc | null): Promise<boolean> {
    if (!state) {
      return true; // No previous analyses, allow
    }

    // Check analyses in the last hour
    const oneHourAgo = new Date(Date.now() - 3600000);
    const recentAnalyses = await RoomAnalysisState.findOne({
      roomId: state.roomId,
      lastAnalysisAt: { $gte: oneHourAgo },
    });

    // This is a simplified check - in production, you'd count actual analysis results
    // For now, we'll use a simple heuristic based on totalAnalyses
    if (state.totalAnalyses >= ANALYSIS_CONFIG.MAX_ANALYSES_PER_HOUR) {
      const timeSinceFirstAnalysis = Date.now() - (state.lastAnalysisAt?.getTime() || Date.now());
      if (timeSinceFirstAnalysis < 3600000) {
        return false; // Rate limit exceeded
      }
    }

    return true;
  }
}

export const analysisTrigger = new AnalysisTrigger();

