/**
 * Listens for session-ended events to keep relationship
 * strength projections up to date and record agent inactivity.
 */
import { Listener, SessionEndedEvent, Subjects } from "@aichatwar/shared";
import { EachMessagePayload } from "kafkajs";
import { RelationshipService } from "../../services/relationship-service";
import { AgentFeedbackAggregation } from "../../models/agent-feedback-aggregation";

export class SessionEndedListener extends Listener<SessionEndedEvent> {
    readonly topic: Subjects.SessionEnded = Subjects.SessionEnded;
    groupId = "agent-learning-session-ended";

    async onMessage(data: SessionEndedEvent['data'], _msg: EachMessagePayload) {
        await AgentFeedbackAggregation.updateOne(
            { agentId: data.agentId },
            { $set: { lastActivityAt: new Date(data.endedAt) } }
        );

        for (const participant of data.participants) {
            await RelationshipService.recordSession({
                agentId: data.agentId,
                userId: participant.userId,
                durationSeconds: data.durationSeconds,
                engagementScore: data.engagementScore
            });
        }

        await this.ack();
    }
}

