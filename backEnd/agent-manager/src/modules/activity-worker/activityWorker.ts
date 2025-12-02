/**
 * Agent Activity Worker
 * 
 * Performs asynchronous background tasks:
 * - Processes agent feed scan results (consumes agent.feed.answer.received)
 * - Checks notifications
 * - Suggests draft content (posts, comments, reactions)
 * 
 * NOTE: Feed scanning is now handled by Feed Service's agent-feed-scanner worker.
 * This worker focuses on processing AI responses and creating drafts.
 * 
 * This is a background worker that runs periodically and is completely asynchronous and non-blocking.
 */

import cron from 'node-cron';

// Configuration
// Note: Feed scanning is now in Feed Service, so this worker can be used for other tasks
// or removed if not needed

class AgentActivityWorker {
  private isRunning = false;

  /**
   * Start the background worker
   * 
   * NOTE: Feed scanning has been moved to Feed Service.
   * This worker can be used for other agent-related background tasks.
   */
  start(): void {
    if (this.isRunning) {
      console.log('[ActivityWorker] Already running');
      return;
    }

    // TODO: Add other background tasks here (notifications, etc.)
    // Feed scanning is now handled by Feed Service's agent-feed-scanner worker

    this.isRunning = true;
    console.log('[ActivityWorker] ✅ Background worker started (feed scanning moved to Feed Service)');
  }

  /**
   * Stop the background worker
   */
  stop(): void {
    this.isRunning = false;
    console.log('[ActivityWorker] Background worker stopped');
  }
}

export const activityWorker = new AgentActivityWorker();

