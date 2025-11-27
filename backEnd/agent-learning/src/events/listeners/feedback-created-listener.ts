/**
 * Main RLHF listener: consumes FeedbackCreated events,
 * updates aggregation projections, stores high-quality
 * interactions, and triggers policy recalculations when
 * thresholds are met.
 */
import { EachMessagePayload } from "kafkajs";
import { FeedbackCreatedEvent, Listener, Subjects } from "@aichatwar/shared";
import { AgentFeedbackAggregation, buildAgentFeedbackAggregation } from "../../models/agent-feedback-aggregation";
import { PolicyTrigger } from "../../services/policy-trigger";
import { PolicyEngine } from "../../services/policy-engine";
import { RewardCalculator } from "../../services/reward-calculator";
import { HighQualityInteraction } from "../../models/high-quality-interaction";

export class FeedbackCreatedListener extends Listener<FeedbackCreatedEvent> {
    readonly topic: Subjects.FeedbackCreated = Subjects.FeedbackCreated;
    groupId = "agent-learning-feedback-created";

    async onMessage(data: FeedbackCreatedEvent['data'], _msg: EachMessagePayload) {
        const rewardComputation = RewardCalculator.fromFeedback(data);

        const existing = await AgentFeedbackAggregation.findOne({ agentId: data.agentId });
        const aggregation = existing ?? buildAgentFeedbackAggregation({ agentId: data.agentId });

        if (rewardComputation.reward >= 0) {
            aggregation.positiveCount += 1;
        } else {
            aggregation.negativeCount += 1;
        }
        aggregation.totalFeedback += 1;
        aggregation.rewardSum += rewardComputation.reward;
        aggregation.pendingFeedbackCount += 1;
        aggregation.pendingRewardSum += rewardComputation.reward;
        aggregation.lastFeedbackAt = new Date(data.createdAt);
        aggregation.lastActivityAt = new Date();
        aggregation.strongSignalPending = aggregation.strongSignalPending || rewardComputation.strongSignal;

        await aggregation.save();

        if (rewardComputation.reward >= 0.6 && data.metadata?.context) {
            await HighQualityInteraction.updateOne(
                { agentId: data.agentId, messageId: data.sourceId },
                {
                    agentId: data.agentId,
                    messageId: data.sourceId,
                    userMessage: data.metadata.context.messageContent,
                    agentResponse: data.metadata.context.agentResponse,
                    feedbackScore: rewardComputation.reward,
                    roomId: data.roomId,
                    timestamp: new Date(data.createdAt)
                },
                { upsert: true }
            );
        }

        const shouldUpdate = PolicyTrigger.shouldUpdate(aggregation, rewardComputation.strongSignal);
        if (shouldUpdate) {
            await PolicyEngine.apply(aggregation.agentId);
        }

        await this.ack();
    }
}

