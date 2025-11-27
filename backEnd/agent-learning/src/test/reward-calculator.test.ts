import { RewardCalculator } from "../services/reward-calculator";

describe("RewardCalculator", () => {
    it("boosts reward for positive rating and reaction", () => {
        const result = RewardCalculator.fromFeedback({
            id: "f1",
            agentId: "agent",
            userId: "user",
            source: "chat",
            sourceId: "msg",
            feedbackType: "explicit",
            value: 0.8,
            metadata: {
                rating: 5,
                reactionType: "love",
                context: {}
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });

        expect(result.reward).toBeGreaterThan(0.9);
        expect(result.strongSignal).toBe(true);
    });

    it("penalizes negative reaction", () => {
        const result = RewardCalculator.fromFeedback({
            id: "f2",
            agentId: "agent",
            userId: "user",
            source: "chat",
            sourceId: "msg",
            feedbackType: "explicit",
            value: -0.4,
            metadata: {
                reactionType: "dislike",
                context: {}
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });

        expect(result.reward).toBeLessThanOrEqual(-0.8);
        expect(result.strongSignal).toBe(true);
    });
});

