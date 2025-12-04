/**
 * Listens to feedback.reply.received events from chat service.
 * Adds replies to agent messages to the Redis feedback batcher.
 * Batcher handles batching, saving to MongoDB, and publishing events.
 */
import { EachMessagePayload } from "kafkajs";
import { FeedbackReplyReceivedEvent, Listener, Subjects } from "@aichatwar/shared";
import { feedbackBatcherRedis } from "../../services/feedback-batcher-redis";

export class FeedbackReplyReceivedListener extends Listener<FeedbackReplyReceivedEvent> {
    readonly topic: Subjects.FeedbackReplyReceived = Subjects.FeedbackReplyReceived;
    groupId = "feedback-service-reply-received";

    async onMessage(data: FeedbackReplyReceivedEvent['data'], _msg: EachMessagePayload) {
        // Calculate reward: replies to agent messages are positive engagement signals
        const reward = 0.4; // Positive signal for engagement

        // Add to Redis batcher - it will handle batching, saving, and publishing
        await feedbackBatcherRedis.add({
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
            },
            receivedAt: new Date().toISOString()
        });

        await this.ack();
    }
}

