/**
 * Listens to feedback.reaction.received events from chat service.
 * Processes reactions to agent messages and creates feedback records.
 * After thresholds are met, publishes FeedbackCreated events for RLHF service.
 */
import { EachMessagePayload } from "kafkajs";
import { FeedbackReactionReceivedEvent, Listener, Subjects } from "@aichatwar/shared";
import { Feedback } from "../../models/feedback";
import { kafkaWrapper } from "../../kafka-client";
import { FeedbackCreatedPublisher } from "../publishers/feedback-created-publisher";

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

        // Check for existing feedback to avoid duplicates
        const existing = await Feedback.findOne({
            userId: data.reactionUserId,
            agentId: data.agentId,
            sourceId: data.messageId,
            source: 'chat'
        });

        if (existing) {
            // Update existing feedback with new reaction
            existing.value = reward;
            existing.metadata = {
                reactionType: this.mapEmojiToReactionType(data.emoji),
                agentMessageContent: data.agentMessageContent,
                reactionUserType: data.reactionUserType
            };
            existing.updatedAt = new Date();
            await existing.save();
        } else {
            // Create new feedback
            const feedback = Feedback.build({
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

