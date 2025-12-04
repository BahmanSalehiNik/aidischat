export interface RewardComputation {
    reward: number;
    strongSignal: boolean;
    tags: string[];
}

export interface FeedbackData {
    id: string;
    feedbackType: 'explicit' | 'implicit' | 'reaction';
    source: 'chat' | 'post' | 'comment' | 'profile';
    sourceId: string;
    agentId: string;
    userId: string;
    roomId?: string;
    value: number;
    metadata?: {
        reactionType?: 'like' | 'love' | 'laugh' | 'wow' | 'sad' | 'dislike';
        rating?: number;
        text?: string;
        context?: {
            messageContent?: string;
            agentResponse?: string;
            conversationLength?: number;
            [key: string]: any;
        };
        [key: string]: any;
    };
    createdAt: string;
    updatedAt: string;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/**
 * Converts diverse feedback metadata into a normalized reward signal.
 * Keeps reward clamped to ±1 and flags "strong signal" events that can
 * bypass normal trigger thresholds.
 */
export class RewardCalculator {
    static fromFeedback(data: FeedbackData): RewardComputation {
        let reward = data.value ?? 0;
        const tags: string[] = [];

        if (data.metadata?.rating) {
            const ratingDelta = (data.metadata.rating - 3) / 5;
            reward += ratingDelta;
            tags.push("rating");
        }

        if (data.metadata?.reactionType) {
            switch (data.metadata.reactionType) {
                case "love":
                case "laugh":
                    reward += 0.2;
                    break;
                case "dislike":
                    reward -= 0.4;
                    break;
            }
            tags.push(`reaction:${data.metadata.reactionType}`);
        }

        if (data.metadata?.context?.conversationLength && data.metadata.context.conversationLength > 300) {
            reward += 0.1;
            tags.push("long_session");
        }

        const strongSignal = reward <= -0.8 || reward >= 0.9 || data.metadata?.reactionType === "dislike";
        return {
            reward: clamp(reward, -1, 1),
            strongSignal,
            tags
        };
    }
}

