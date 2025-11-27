import { AgentRelationshipStrength, buildAgentRelationshipStrength } from "../models/agent-relationship-strength";
import { AgentFeedbackAggregation } from "../models/agent-feedback-aggregation";

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/**
 * Maintains per-user relationship strength with agents based on session data.
 */
export class RelationshipService {
    static async recordSession({
        agentId,
        userId,
        durationSeconds,
        engagementScore
    }: {
        agentId: string;
        userId: string;
        durationSeconds: number;
        engagementScore: number;
    }): Promise<void> {
        const existing = await AgentRelationshipStrength.findOne({ agentId, userId });
        const relationship = existing ?? buildAgentRelationshipStrength({ agentId, userId });

        relationship.interactionCount += 1;
        relationship.avgSessionDuration = this.computeRollingAverage(
            relationship.avgSessionDuration,
            durationSeconds,
            relationship.interactionCount
        );
        relationship.relationshipStrength = clamp(
            relationship.relationshipStrength * 0.7 + engagementScore * 0.3,
            0,
            1
        );
        relationship.lastSeenAt = new Date();

        await relationship.save();

        await AgentFeedbackAggregation.updateOne(
            { agentId },
            { $set: { lastActivityAt: new Date() } }
        );
    }

    private static computeRollingAverage(current: number, next: number, count: number): number {
        if (count <= 1) {
            return next;
        }
        return current + (next - current) / count;
    }
}

