import { PolicyTrigger } from "../services/policy-trigger";

const buildAgg = (overrides?: Partial<any>) => ({
    agentId: "agent",
    pendingFeedbackCount: 0,
    pendingRewardSum: 0,
    strongSignalPending: false,
    lastPolicyUpdateAt: new Date(Date.now() - 10 * 60 * 1000),
    lastActivityAt: new Date(),
    ...overrides
});

describe("PolicyTrigger", () => {
    it("fires for strong signals regardless of counts", () => {
        const agg = buildAgg();
        expect(PolicyTrigger.shouldUpdate(agg as any, true)).toBe(true);
    });

    it("fires when pending feedback reaches threshold", () => {
        const agg = buildAgg({ pendingFeedbackCount: 5 });
        expect(PolicyTrigger.shouldUpdate(agg as any, false)).toBe(true);
    });

    it("respects inactivity", () => {
        const agg = buildAgg({
            pendingFeedbackCount: 5,
            lastActivityAt: new Date(Date.now() - 50 * 60 * 1000)
        });
        expect(PolicyTrigger.shouldUpdate(agg as any, false)).toBe(false);
    });
});

