/**
 * Listens to feedback.reply.received events from chat service.
 * Processes replies to agent messages and creates feedback records.
 * After thresholds are met, publishes FeedbackCreated events for RLHF service.
 */
import { EachMessagePayload } from "kafkajs";
import { FeedbackReplyReceivedEvent, Listener, Subjects } from "@aichatwar/shared";
import { Feedback } from "../../models/feedback";
import { kafkaWrapper } from "../../kafka-client";
import { FeedbackCreatedPublisher } from "../publishers/feedback-created-publisher";

export class FeedbackReplyReceivedListener extends Listener<FeedbackReplyReceivedEvent> {
    readonly topic: Subjects.FeedbackReplyReceived = Subjects.FeedbackReplyReceived;
    groupId = "feedback-service-reply-received";

    async onMessage(data: FeedbackReplyReceivedEvent['data'], _msg: EachMessagePayload) {
        // Calculate reward: replies to agent messages are positive engagement signals
        const reward = 0.4; // Positive signal for engagement

        // Check for existing feedback to avoid duplicates
        const existing = await Feedback.findOne({
            userId: data.replySenderId,
            agentId: data.agentId,
            sourceId: data.messageId,
            source: 'chat'
        });

        if (existing) {
            // Update existing feedback
            existing.value = reward;
            existing.metadata = {
                replyContent: data.replyContent,
                agentMessageContent: data.agentMessageContent,
                replySenderType: data.replySenderType
            };
            existing.updatedAt = new Date();
            await existing.save();
        } else {
            // Create new feedback
            const feedback = Feedback.build({
                feedbackType: 'implicit',
                source: 'chat',
                sourceId: data.messageId,
                agentId: data.agentId,
                userId: data.replySenderId,
                roomId: data.roomId,
                value: reward,
                metadata: {
                    replyContent: data.replyContent,
                    agentMessageContent: data.agentMessageContent,
                    replySenderType: data.replySenderType
                }
            });
            await feedback.save();

            // Publish FeedbackCreated event for RLHF service
            await new FeedbackCreatedPublisher(kafkaWrapper.producer).publish({
                id: feedback.id,
                feedbackType: feedback.feedbackType,
                source: feedback.source,
                sourceId: feedback.sourceId,
                agentId: feedback.agentId,
                userId: feedback.userId,
                roomId: feedback.roomId,
                value: feedback.value,
                metadata: feedback.metadata,
                createdAt: feedback.createdAt.toISOString(),
                updatedAt: feedback.updatedAt.toISOString()
            });
        }

        await this.ack();
    }
}

