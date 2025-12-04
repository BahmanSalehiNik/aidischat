/**
 * Feedback Batch Worker
 * 
 * Periodically checks Redis for batches that need to be flushed:
 * - Batches that have exceeded time threshold
 * - Runs on all pods (only one will process each batch due to Redis operations)
 * 
 * Architecture:
 * - All pods run this worker
 * - Worker checks Redis for stale batches
 * - Uses Redis operations to claim batches (prevent concurrent processing)
 * - Flushes batches that exceed time threshold
 */

import { feedbackBatcherRedis } from '../services/feedback-batcher-redis';
import { redisFeedback, RedisFeedbackKeys } from '../redis-client';

// Configuration
const WORKER_CHECK_INTERVAL_MS = parseInt(process.env.FEEDBACK_WORKER_CHECK_INTERVAL_MS || '60000', 10); // 1 minute default
const BATCH_TIME_THRESHOLD_MS = parseInt(process.env.FEEDBACK_BATCH_TIME_MS || '300000', 10); // 5 minutes default

class FeedbackBatchWorker {
    private interval: NodeJS.Timeout | null = null;
    private isRunning: boolean = false;

    /**
     * Start the worker
     */
    start(): void {
        if (this.interval) {
            console.log('[FeedbackBatchWorker] Worker already running');
            return;
        }

        console.log('[FeedbackBatchWorker] Starting worker...');
        this.interval = setInterval(() => {
            this.processStaleBatches().catch(err => {
                console.error('[FeedbackBatchWorker] Error processing stale batches:', err);
            });
        }, WORKER_CHECK_INTERVAL_MS);

        // Run immediately on start
        this.processStaleBatches().catch(err => {
            console.error('[FeedbackBatchWorker] Error in initial batch processing:', err);
        });
    }

    /**
     * Stop the worker
     */
    stop(): void {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
            console.log('[FeedbackBatchWorker] Worker stopped');
        }
    }

    /**
     * Process batches that have exceeded time threshold
     */
    private async processStaleBatches(): Promise<void> {
        if (this.isRunning) {
            return; // Prevent concurrent runs
        }

        this.isRunning = true;

        try {
            const now = Date.now();
            const agentIds = await feedbackBatcherRedis.getPendingBatches();
            
            if (agentIds.length === 0) {
                return;
            }

            console.log(`[FeedbackBatchWorker] Checking ${agentIds.length} pending batches`);

            const staleBatches: string[] = [];

            // Check each batch for staleness
            for (const agentId of agentIds) {
                const metadata = await feedbackBatcherRedis.getBatchMetadata(agentId);
                if (!metadata) {
                    continue; // Batch was already flushed
                }

                const age = now - new Date(metadata.lastItemAt).getTime();
                if (age >= BATCH_TIME_THRESHOLD_MS) {
                    staleBatches.push(agentId);
                }
            }

            if (staleBatches.length === 0) {
                return;
            }

            console.log(`[FeedbackBatchWorker] Found ${staleBatches.length} stale batches to flush`);

            // Process stale batches (limit concurrent flushes)
            const batchSize = 10; // Process 10 at a time
            for (let i = 0; i < staleBatches.length; i += batchSize) {
                const batch = staleBatches.slice(i, i + batchSize);
                await Promise.all(
                    batch.map(agentId =>
                        feedbackBatcherRedis.flush(agentId).catch(err => {
                            console.error(`[FeedbackBatchWorker] Error flushing batch for agent ${agentId}:`, err);
                        })
                    )
                );
            }

            console.log(`[FeedbackBatchWorker] Processed ${staleBatches.length} stale batches`);
        } catch (error) {
            console.error('[FeedbackBatchWorker] Error in processStaleBatches:', error);
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Flush all pending batches (used during graceful shutdown)
     */
    async flushAll(): Promise<void> {
        console.log('[FeedbackBatchWorker] Flushing all pending batches...');
        
        const agentIds = await feedbackBatcherRedis.getPendingBatches();
        console.log(`[FeedbackBatchWorker] Found ${agentIds.length} batches to flush`);

        // Flush all batches
        await Promise.all(
            agentIds.map(agentId =>
                feedbackBatcherRedis.flush(agentId).catch(err => {
                    console.error(`[FeedbackBatchWorker] Error flushing batch for agent ${agentId} during shutdown:`, err);
                })
            )
        );

        console.log('[FeedbackBatchWorker] All batches flushed');
    }
}

// Singleton instance
export const feedbackBatchWorker = new FeedbackBatchWorker();

