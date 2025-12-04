/**
 * Listens to feedback.reaction.received events from chat service.
 * Adds reactions to agent messages to the Redis feedback batcher.
 * Batcher handles batching, saving to MongoDB, and publishing events.
 */
import { EachMessagePayload } from "kafkajs";
import { FeedbackReactionReceivedEvent, Listener, Subjects } from "@aichatwar/shared";
import { feedbackBatcherRedis } from "../../services/feedback-batcher-redis";

// Map emoji reactions to reward values
const REACTION_REWARDS: Record<string, number> = {
    '👍': 0.6,  // like - positive
    '❤️': 0.8,  // love - very positive
    '😂': 0.7,  // laugh - positive
    '😮': 0.5,  // wow - neutral-positive
    '😢': -0.3, // sad - negative
    '👎': -0.6  // dislike - negative
};

export class FeedbackReactionReceivedListener extends Listener<FeedbackReactionReceivedEvent> {
    readonly topic: Subjects.FeedbackReactionReceived = Subjects.FeedbackReactionReceived;
    groupId = "feedback-service-reaction-received";

    async onMessage(data: FeedbackReactionReceivedEvent['data'], _msg: EachMessagePayload) {
        // Calculate reward based on emoji type
        const reward = REACTION_REWARDS[data.emoji] || 0.2; // Default to slight positive for unknown emojis

        // Add to Redis batcher - it will handle batching, saving, and publishing
        await feedbackBatcherRedis.add({
            feedbackType: 'reaction',
            source: 'chat',
            sourceId: data.messageId,
            agentId: data.agentId,
            userId: data.reactionUserId,
            roomId: data.roomId,
            value: reward,
            metadata: {
                reactionType: this.mapEmojiToReactionType(data.emoji),
                agentMessageContent: data.agentMessageContent,
                reactionUserType: data.reactionUserType
            },
            receivedAt: new Date().toISOString()
        });

        await this.ack();
    }

    private mapEmojiToReactionType(emoji: string): 'like' | 'love' | 'laugh' | 'wow' | 'sad' | 'dislike' {
        const mapping: Record<string, 'like' | 'love' | 'laugh' | 'wow' | 'sad' | 'dislike'> = {
            '👍': 'like',
            '❤️': 'love',
            '😂': 'laugh',
            '😮': 'wow',
            '😢': 'sad',
            '👎': 'dislike'
        };
        return mapping[emoji] || 'like';
    }
}

