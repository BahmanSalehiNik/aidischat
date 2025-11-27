import { AgentFeedbackAggregationDoc } from "../models/agent-feedback-aggregation";

/**
 * Encapsulates the trigger logic described in the roadmap:
 * feedback threshold, time-based updates, inactivity guard, etc.
 */
const MIN_FEEDBACK_THRESHOLD = 5;
const MAX_UPDATE_INTERVAL_MS = 5 * 60 * 1000;
const INACTIVITY_THRESHOLD_MS = 40 * 60 * 1000;

export class PolicyTrigger {
    static shouldUpdate(agg: AgentFeedbackAggregationDoc, strongSignal: boolean): boolean {
        const now = Date.now();

        if (agg.lastActivityAt && now - agg.lastActivityAt.getTime() > INACTIVITY_THRESHOLD_MS) {
            return false;
        }

        if (strongSignal || agg.strongSignalPending) {
            return true;
        }

        if (agg.pendingFeedbackCount >= MIN_FEEDBACK_THRESHOLD) {
            return true;
        }

        if (agg.pendingFeedbackCount > 0 && agg.lastPolicyUpdateAt) {
            if (now - agg.lastPolicyUpdateAt.getTime() >= MAX_UPDATE_INTERVAL_MS) {
                return true;
            }
        }

        return false;
    }
}

