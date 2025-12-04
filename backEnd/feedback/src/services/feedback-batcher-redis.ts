/**
 * FeedbackBatcherRedis - Redis-based sliding window service for feedback events
 * 
 * Uses Redis as a sliding window (3 items per agentId+roomId for testing):
 * - Stores feedback items in Redis lists with max 3 items per agentId+roomId
 * - Batches processing based on:
 *   - Batch size threshold (default: 10 items across all windows)
 *   - Time threshold (default: 5 minutes)
 * 
 * When either threshold is reached, flushes the batch by:
 * 1. Loading all items from Redis sliding windows
 * 2. Processing feedback through learning pipeline (aggregation, policy updates)
 * 3. Publishing agent.learning.updated events
 * 4. Clearing processed items from Redis
 */

import { AgentLearningUpdatedPublisher } from '../events/publishers/agent-learning-updated-publisher';
import { kafkaWrapper } from '../kafka-client';
import { redisFeedback, RedisFeedbackKeys } from '../redis-client';
import { AgentFeedbackAggregation, buildAgentFeedbackAggregation } from '../models/agent-feedback-aggregation';
import { AgentLearningSummary, buildAgentLearningSummary } from '../models/agent-learning-summary';
import { RewardCalculator, FeedbackData } from './reward-calculator';
import { PolicyTrigger } from './policy-trigger';
import { PolicyEngine } from './policy-engine';
import { HighQualityInteraction } from '../models/high-quality-interaction';

// Configuration
// Batch size reduced to match sliding window size for faster processing
// With SLIDING_WINDOW_SIZE=3, we'll flush when we have 3 items (one full window)
const BATCH_SIZE = parseInt(process.env.FEEDBACK_BATCH_SIZE || '3', 10); // Default to 3 to match sliding window
const BATCH_TIME_THRESHOLD_MS = parseInt(process.env.FEEDBACK_BATCH_TIME_MS || '300000', 10); // 5 minutes default
const SLIDING_WINDOW_SIZE = 3; // Max 3 items per agentId+roomId (reduced for testing)

export interface PendingFeedbackItem {
    id: string; // Generated ID for this feedback item
    feedbackType: 'explicit' | 'implicit' | 'reaction';
    source: 'chat' | 'post' | 'comment' | 'profile';
    sourceId: string;
    agentId: string;
    userId: string;
    roomId?: string;
    value: number;
    metadata?: Record<string, any>;
    receivedAt: string; // ISO string for Redis storage
    createdAt: string; // ISO string
    updatedAt: string; // ISO string
}

interface BatchMetadata {
    agentId: string;
    createdAt: string;
    lastItemAt: string;
    itemCount: number;
}

export class FeedbackBatcherRedis {
    private publisher: AgentLearningUpdatedPublisher | null = null;
    private flushInProgress: Set<string> = new Set();

    private getPublisher(): AgentLearningUpdatedPublisher | null {
        try {
            if (!this.publisher) {
                // Only create publisher if Kafka is connected
                if (!kafkaWrapper.producer) {
                    console.warn('[FeedbackBatcherRedis] Kafka producer not available, skipping event publishing');
                    return null;
                }
                this.publisher = new AgentLearningUpdatedPublisher(kafkaWrapper.producer);
            }
            return this.publisher;
        } catch (error) {
            console.warn('[FeedbackBatcherRedis] Error getting publisher (Kafka may not be connected):', error instanceof Error ? error.message : String(error));
            return null;
        }
    }

    /**
     * Add a feedback item to the sliding window (5 items per agentId+roomId)
     */
    async add(item: Omit<PendingFeedbackItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
        const { agentId, roomId } = item;
        const now = new Date().toISOString();
        
        // Generate ID for this feedback item
        const feedbackId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const feedbackItem: PendingFeedbackItem = {
            ...item,
            id: feedbackId,
            createdAt: now,
            updatedAt: now
        };

        // Get sliding window key for this agentId+roomId
        const windowKey = RedisFeedbackKeys.window(agentId, roomId);
        const metaKey = RedisFeedbackKeys.batchMeta(agentId);
        const indexKey = RedisFeedbackKeys.batchIndex();

        // Add to sliding window (LPUSH + LTRIM to keep only 5 items)
        const pipeline = redisFeedback.pipeline();
        pipeline.lpush(windowKey, JSON.stringify(feedbackItem));
        pipeline.ltrim(windowKey, 0, SLIDING_WINDOW_SIZE - 1); // Keep only last 5 items
        pipeline.expire(windowKey, 86400); // 24 hour TTL
        
        // Update batch metadata
        const existingMeta = await redisFeedback.get(metaKey);
        let metadata: BatchMetadata;
        
        if (existingMeta) {
            metadata = JSON.parse(existingMeta);
            metadata.lastItemAt = now;
            metadata.itemCount += 1;
        } else {
            metadata = {
                agentId,
                createdAt: now,
                lastItemAt: now,
                itemCount: 1
            };
            pipeline.sadd(indexKey, agentId);
        }
        
        pipeline.set(metaKey, JSON.stringify(metadata));
        pipeline.pexpire(metaKey, BATCH_TIME_THRESHOLD_MS + 60000);
        await pipeline.exec();

        // Check if batch size threshold reached
        if (metadata.itemCount >= BATCH_SIZE) {
            await this.flush(agentId);
        }
    }

    /**
     * Flush the batch for a specific agent (processes all sliding windows for this agent)
     */
    async flush(agentId: string): Promise<void> {
        if (this.flushInProgress.has(agentId)) {
            return;
        }
        this.flushInProgress.add(agentId);

        try {
            const metaKey = RedisFeedbackKeys.batchMeta(agentId);
            const indexKey = RedisFeedbackKeys.batchIndex();

            // Get all sliding windows for this agent (pattern: feedback:window:{agentId}:*)
            const pattern = `feedback:window:${agentId}:*`;
            const keys = await redisFeedback.keys(pattern);
            
            if (keys.length === 0) {
                // No windows to process
                this.flushInProgress.delete(agentId);
                return;
            }

            // Collect all items from all windows for this agent
            const itemsToProcess: PendingFeedbackItem[] = [];
            for (const windowKey of keys) {
                const itemsJson = await redisFeedback.lrange(windowKey, 0, -1);
                const items = itemsJson.map((json: string) => JSON.parse(json) as PendingFeedbackItem);
                itemsToProcess.push(...items);
            }

            if (itemsToProcess.length === 0) {
                this.flushInProgress.delete(agentId);
                return;
            }

            console.log(`[FeedbackBatcherRedis] Flushing batch for agent ${agentId}: ${itemsToProcess.length} items from ${keys.length} windows`);

            // Process items through learning pipeline
            await this.processBatch(itemsToProcess);

            // Clear processed windows and metadata
            const pipeline = redisFeedback.pipeline();
            for (const windowKey of keys) {
                pipeline.del(windowKey);
            }
            pipeline.del(metaKey);
            pipeline.srem(indexKey, agentId);
            await pipeline.exec();

            console.log(`[FeedbackBatcherRedis] Successfully flushed batch for agent ${agentId}: ${itemsToProcess.length} items processed`);
        } catch (error) {
            console.error(`[FeedbackBatcherRedis] Error flushing batch for agent ${agentId}:`, error);
            throw error;
        } finally {
            this.flushInProgress.delete(agentId);
        }
    }

    /**
     * Process a batch of items: process through learning pipeline (no MongoDB)
     */
    private async processBatch(itemsToProcess: PendingFeedbackItem[]): Promise<void> {
        if (itemsToProcess.length === 0) {
            return;
        }

        try {
            // Process feedback through learning pipeline
            // Group by agentId to process per-agent
            const feedbackByAgent = new Map<string, PendingFeedbackItem[]>();
            for (const feedback of itemsToProcess) {
                const agentId = feedback.agentId;
                if (!feedbackByAgent.has(agentId)) {
                    feedbackByAgent.set(agentId, []);
                }
                feedbackByAgent.get(agentId)!.push(feedback);
            }

            // Process each agent's feedback
            for (const [agentId, agentFeedbacks] of feedbackByAgent.entries()) {
                await this.processAgentFeedback(agentId, agentFeedbacks);
            }

            console.log(`[FeedbackBatcherRedis] Successfully processed batch: ${itemsToProcess.length} items`);
        } catch (error) {
            console.error(`[FeedbackBatcherRedis] Error processing batch:`, error);
            throw error;
        }
    }

    /**
     * Process feedback for a specific agent through the learning pipeline
     */
    private async processAgentFeedback(agentId: string, feedbacks: PendingFeedbackItem[]): Promise<void> {
        // Ensure aggregation and summary exist
        let aggregation = await AgentFeedbackAggregation.findOne({ agentId });
        if (!aggregation) {
            aggregation = buildAgentFeedbackAggregation({ agentId });
            await aggregation.save();
        }

        let summary = await AgentLearningSummary.findOne({ agentId });
        if (!summary) {
            // Create summary without ownerUserId (will be set when agent.created event is received)
            // For now, use a placeholder - agent.created listener will update it
            summary = buildAgentLearningSummary({
                agentId,
                ownerUserId: 'pending' // Placeholder, will be updated by agent.created listener
            });
            await summary.save();
        }

        // Process each feedback item
        for (const feedback of feedbacks) {
            const feedbackData: FeedbackData = {
                id: feedback.id,
                feedbackType: feedback.feedbackType,
                source: feedback.source,
                sourceId: feedback.sourceId,
                agentId: feedback.agentId,
                userId: feedback.userId,
                roomId: feedback.roomId,
                value: feedback.value,
                metadata: feedback.metadata,
                createdAt: feedback.createdAt,
                updatedAt: feedback.updatedAt
            };

            const rewardComputation = RewardCalculator.fromFeedback(feedbackData);

            // Update aggregation
            if (rewardComputation.reward >= 0) {
                aggregation.positiveCount += 1;
            } else {
                aggregation.negativeCount += 1;
            }
            aggregation.totalFeedback += 1;
            aggregation.rewardSum += rewardComputation.reward;
            aggregation.pendingFeedbackCount += 1;
            aggregation.pendingRewardSum += rewardComputation.reward;
            aggregation.lastFeedbackAt = new Date(feedback.createdAt);
            aggregation.lastActivityAt = new Date();
            aggregation.strongSignalPending = aggregation.strongSignalPending || rewardComputation.strongSignal;

            // Store high-quality interactions
            if (rewardComputation.reward >= 0.6 && feedback.metadata?.context) {
                await HighQualityInteraction.updateOne(
                    { agentId: feedback.agentId, messageId: feedback.sourceId },
                    {
                        agentId: feedback.agentId,
                        messageId: feedback.sourceId,
                        userMessage: feedback.metadata.context.messageContent,
                        agentResponse: feedback.metadata.context.agentResponse,
                        feedbackScore: rewardComputation.reward,
                        roomId: feedback.roomId,
                        timestamp: new Date(feedback.createdAt)
                    },
                    { upsert: true }
                );
            }
        }

        // Save aggregation
        await aggregation.save();

        // Check if should trigger policy update
        const lastFeedback = feedbacks[feedbacks.length - 1];
        const feedbackData: FeedbackData = {
            id: lastFeedback.id,
            feedbackType: lastFeedback.feedbackType,
            source: lastFeedback.source,
            sourceId: lastFeedback.sourceId,
            agentId: lastFeedback.agentId,
            userId: lastFeedback.userId,
            roomId: lastFeedback.roomId,
            value: lastFeedback.value,
            metadata: lastFeedback.metadata,
            createdAt: lastFeedback.createdAt,
            updatedAt: lastFeedback.updatedAt
        };
        const rewardComputation = RewardCalculator.fromFeedback(feedbackData);

        const shouldUpdate = PolicyTrigger.shouldUpdate(aggregation, rewardComputation.strongSignal);
        if (shouldUpdate) {
            await PolicyEngine.apply(agentId);
        }
    }

    /**
     * Get all agentIds with pending batches
     */
    async getPendingBatches(): Promise<string[]> {
        const indexKey = RedisFeedbackKeys.batchIndex();
        const agentIds = await redisFeedback.smembers(indexKey);
        return agentIds;
    }

    /**
     * Get batch metadata for an agent
     */
    async getBatchMetadata(agentId: string): Promise<BatchMetadata | null> {
        const metaKey = RedisFeedbackKeys.batchMeta(agentId);
        const metaJson = await redisFeedback.get(metaKey);
        if (!metaJson) {
            return null;
        }
        return JSON.parse(metaJson);
    }

    /**
     * Get current batch statistics (for monitoring)
     */
    async getStats(): Promise<{
        totalBatches: number;
        totalItems: number;
        batches: Array<{ agentId: string; itemCount: number; age: number }>;
    }> {
        const agentIds = await this.getPendingBatches();
        const batches = [];

        for (const agentId of agentIds) {
            const metadata = await this.getBatchMetadata(agentId);
            if (metadata) {
                // Count items in all windows for this agent
                const pattern = `feedback:window:${agentId}:*`;
                const keys = await redisFeedback.keys(pattern);
                let totalItems = 0;
                for (const key of keys) {
                    const length = await redisFeedback.llen(key);
                    totalItems += length;
                }
                
                batches.push({
                    agentId,
                    itemCount: totalItems,
                    age: Date.now() - new Date(metadata.lastItemAt).getTime()
                });
            }
        }

        return {
            totalBatches: batches.length,
            totalItems: batches.reduce((sum, b) => sum + b.itemCount, 0),
            batches
        };
    }
}

// Singleton instance
export const feedbackBatcherRedis = new FeedbackBatcherRedis();

