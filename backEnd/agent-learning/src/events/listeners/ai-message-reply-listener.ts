/**
 * Records outgoing agent actions so feedback can be
 * correlated later and action success rates tracked.
 */
import { AiMessageReplyEvent, Listener, Subjects } from "@aichatwar/shared";
import { EachMessagePayload } from "kafkajs";
import { BehaviorHistoryService } from "../../services/behavior-history-service";
import { AgentFeedbackAggregation } from "../../models/agent-feedback-aggregation";

export class AiMessageReplyListener extends Listener<AiMessageReplyEvent> {
    readonly topic: Subjects.AiMessageReply = Subjects.AiMessageReply;
    groupId = "agent-learning-ai-message-reply";

    async onMessage(data: AiMessageReplyEvent['data'], _msg: EachMessagePayload) {
        await BehaviorHistoryService.recordAction({
            agentId: data.agentId,
            actionType: "reply",
            metadata: {
                roomId: data.roomId,
                replyTo: data.replyToMessageId
            }
        });

        await AgentFeedbackAggregation.updateOne(
            { agentId: data.agentId },
            { $set: { lastActivityAt: new Date() } }
        );

        await this.ack();
    }
}

