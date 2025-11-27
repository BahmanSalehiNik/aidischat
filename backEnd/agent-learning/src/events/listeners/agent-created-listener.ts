/**
 * Seeds RLHF projections when a new agent is created.
 * Ensures both summary + aggregation docs exist before
 * any feedback events arrive.
 */
import { AgentCreatedEvent, Listener, Subjects } from "@aichatwar/shared";
import { EachMessagePayload } from "kafkajs";
import { AgentLearningSummary, buildAgentLearningSummary } from "../../models/agent-learning-summary";
import { AgentFeedbackAggregation, buildAgentFeedbackAggregation } from "../../models/agent-feedback-aggregation";

export class AgentCreatedListener extends Listener<AgentCreatedEvent> {
    readonly topic: Subjects.AgentCreated = Subjects.AgentCreated;
    groupId = "agent-learning-agent-created";

    async onMessage(data: AgentCreatedEvent['data'], _msg: EachMessagePayload) {
        const existingSummary = await AgentLearningSummary.findOne({ agentId: data.id });
        if (!existingSummary) {
            const summary = buildAgentLearningSummary({
                agentId: data.id,
                ownerUserId: data.ownerUserId
            });
            await summary.save();
        }

        const existingAggregation = await AgentFeedbackAggregation.findOne({ agentId: data.id });
        if (!existingAggregation) {
            await buildAgentFeedbackAggregation({ agentId: data.id }).save();
        }

        await this.ack();
    }
}

