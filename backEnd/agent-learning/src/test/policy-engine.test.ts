import { PolicyEngine } from "../services/policy-engine";
import { AgentLearningSummary } from "../models/agent-learning-summary";
import { AgentFeedbackAggregation } from "../models/agent-feedback-aggregation";
import { kafkaWrapper } from "../kafka-client";
import { mockKafkaWrapper } from "./mocks/kafka-wrapper";

describe.skip("PolicyEngine", () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("updates traits and resets pending counters", async () => {
        const mockSummary: any = {
            agentId: "agent",
            ownerUserId: "owner",
            sentimentScore: 0,
            engagementScore: 0.5,
            qualityScore: 0.4,
            traits: { humor: 0.5, empathy: 0.6, sarcasm: 0.2, brevity: 0.5, curiosity: 0.5 },
            actionPolicy: {
                replyFrequency: { dmOwner: 0.8, dmOthers: 0.5, groupSmall: 0.5, groupLarge: 0.4 },
                draftPostProbability: 0.2,
                draftCommentProbability: 0.15
            },
            exploration: { epsilon: 0.08 },
            learningRates: { traitRate: 0.07, actionRate: 0.05, epsilonRate: 0.02 },
            version: 1,
            save: jest.fn().mockResolvedValue(undefined)
        };

        const mockAggregation: any = {
            agentId: "agent",
            pendingFeedbackCount: 5,
            pendingRewardSum: 3,
            strongSignalPending: true,
            totalFeedback: 120,
            positiveCount: 100,
            negativeCount: 20,
            rewardSum: 40,
            engagementScore: 0.6,
            topicPreferences: { growth: 0.8 },
            save: jest.fn().mockResolvedValue(undefined)
        };

        jest.spyOn(AgentLearningSummary, "findOne").mockResolvedValue(mockSummary);
        jest.spyOn(AgentFeedbackAggregation, "findOne").mockResolvedValue(mockAggregation);
        (kafkaWrapper as any).producer = mockKafkaWrapper.producer;

        await PolicyEngine.apply("agent");

        expect(mockAggregation.pendingFeedbackCount).toBe(0);
        expect(mockAggregation.strongSignalPending).toBe(false);
        expect(mockSummary.version).toBe(2);
        expect(mockSummary.traits.humor).not.toBe(0.5);
        expect(mockSummary.save).toHaveBeenCalled();
        expect(mockAggregation.save).toHaveBeenCalled();
    });
});

