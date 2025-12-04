/**
 * Analyzes projections + pending rewards, applies learning rates,
 * clamps values, and publishes AgentLearningUpdatedEvent to Kafka.
 */
import { AgentFeedbackAggregation } from "../models/agent-feedback-aggregation";
import { AgentLearningSummary, traitDefaults, TraitName } from "../models/agent-learning-summary";
import { AgentLearningUpdatedPublisher } from "../events/publishers/agent-learning-updated-publisher";
import { kafkaWrapper } from "../kafka-client";

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const traitList: TraitName[] = ['humor', 'empathy', 'sarcasm', 'brevity', 'curiosity'];

export class PolicyEngine {
    static async apply(agentId: string): Promise<void> {
        const aggregation = await AgentFeedbackAggregation.findOne({ agentId });
        const summary = await AgentLearningSummary.findOne({ agentId });

        if (!aggregation || !summary) {
            return;
        }

        if (aggregation.pendingFeedbackCount === 0) {
            return;
        }

        const now = new Date();
        const pendingAvgReward = aggregation.pendingRewardSum / Math.max(aggregation.pendingFeedbackCount, 1);

        // Update high-level metrics
        summary.sentimentScore = clamp(
            summary.sentimentScore * 0.7 + pendingAvgReward * 0.3,
            -1,
            1
        );
        summary.qualityScore = clamp(
            summary.qualityScore * 0.6 + Math.abs(pendingAvgReward) * 0.4,
            0,
            1
        );
        summary.engagementScore = clamp(
            summary.engagementScore * 0.8 + aggregation.engagementScore * 0.2,
            0,
            1
        );

        const { traitRate, actionRate, epsilonRate } = summary.learningRates;

        // Traits
        traitList.forEach(trait => {
            const current = summary.traits[trait] ?? traitDefaults[trait];
            const direction = trait === 'sarcasm' ? -1 : 1;
            summary.traits[trait] = clamp(
                current + direction * traitRate * pendingAvgReward,
                0,
                1
            );
        });

        // Action policy
        summary.actionPolicy.replyFrequency.dmOwner = clamp(
            summary.actionPolicy.replyFrequency.dmOwner + actionRate * pendingAvgReward,
            0.2,
            1
        );
        summary.actionPolicy.replyFrequency.dmOthers = clamp(
            summary.actionPolicy.replyFrequency.dmOthers + actionRate * pendingAvgReward,
            0.2,
            1
        );
        summary.actionPolicy.replyFrequency.groupSmall = clamp(
            summary.actionPolicy.replyFrequency.groupSmall + actionRate * pendingAvgReward,
            0.2,
            1
        );
        summary.actionPolicy.replyFrequency.groupLarge = clamp(
            summary.actionPolicy.replyFrequency.groupLarge + actionRate * pendingAvgReward,
            0.1,
            0.9
        );
        summary.actionPolicy.draftPostProbability = clamp(
            summary.actionPolicy.draftPostProbability + (actionRate / 2) * pendingAvgReward,
            0.05,
            0.5
        );
        summary.actionPolicy.draftCommentProbability = clamp(
            summary.actionPolicy.draftCommentProbability + (actionRate / 2) * pendingAvgReward,
            0.05,
            0.4
        );

        // Exploration epsilon
        const epsilonDelta = pendingAvgReward > 0 ? -epsilonRate * 0.5 : epsilonRate;
        summary.exploration.epsilon = clamp(
            summary.exploration.epsilon + epsilonDelta,
            0.01,
            0.25
        );

        summary.version += 1;
        summary.lastPolicyUpdateAt = now;
        summary.lastActivityAt = aggregation.lastActivityAt ?? now;

        aggregation.pendingFeedbackCount = 0;
        aggregation.pendingRewardSum = 0;
        aggregation.strongSignalPending = false;
        aggregation.lastPolicyUpdateAt = now;

        await summary.save();
        await aggregation.save();

        const preferenceTopics = aggregation.topicPreferences || {};
        const responseLength = summary.traits.brevity > 0.7 ? 'short' : summary.traits.brevity < 0.3 ? 'long' : 'medium';

        // Only publish if we have ownerUserId (set by agent.created listener)
        if (!summary.ownerUserId || summary.ownerUserId === 'pending') {
            console.log(`[PolicyEngine] Skipping publish for agent ${agentId} - ownerUserId not set yet`);
            return;
        }

        // Check if Kafka is available before publishing
        try {
            if (!kafkaWrapper.producer) {
                console.warn(`[PolicyEngine] Kafka producer not available, skipping event publish for agent ${agentId}`);
                return;
            }
        } catch (error) {
            console.warn(`[PolicyEngine] Error accessing Kafka producer (may not be connected), skipping event publish:`, error instanceof Error ? error.message : String(error));
            return;
        }

        await new AgentLearningUpdatedPublisher(kafkaWrapper.producer).publish({
            agentId: summary.agentId,
            ownerUserId: summary.ownerUserId,
            learningMetrics: {
                sentimentScore: summary.sentimentScore,
                engagementScore: summary.engagementScore,
                qualityScore: summary.qualityScore,
                preferenceWeights: {
                    topics: preferenceTopics,
                    communicationStyle: {
                        empathy: summary.traits.empathy,
                        humor: summary.traits.humor,
                        sarcasm: summary.traits.sarcasm
                    },
                    responseLength
                },
                behaviorPatterns: {
                    commonPhrases: [],
                    preferredTopics: Object.keys(preferenceTopics),
                    interactionStyle: summary.traits.empathy > 0.7 ? 'supportive' : 'balanced'
                }
            },
            feedbackStats: {
                totalFeedback: aggregation.totalFeedback,
                positiveCount: aggregation.positiveCount,
                negativeCount: aggregation.negativeCount,
                lastUpdated: now.toISOString()
            },
            version: summary.version,
            updatedAt: now.toISOString()
        });
    }
}

