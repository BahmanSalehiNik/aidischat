import { AgentBehaviorHistory, buildAgentBehaviorHistory } from "../models/agent-behavior-history";

const MAX_ACTIONS = 50;

/**
 * Tracks recent agent actions so we can later correlate rewards
 * and compute success rates per action type.
 */
export class BehaviorHistoryService {
    static async recordAction({
        agentId,
        actionType,
        metadata
    }: {
        agentId: string;
        actionType: string;
        metadata?: Record<string, any>;
    }): Promise<void> {
        const existing = await AgentBehaviorHistory.findOne({ agentId });
        const history = existing ?? buildAgentBehaviorHistory({ agentId });

        history.lastActions.unshift({
            actionType,
            reward: 0,
            timestamp: new Date(),
            metadata
        });

        if (history.lastActions.length > MAX_ACTIONS) {
            history.lastActions = history.lastActions.slice(0, MAX_ACTIONS);
        }

        const stats = history.actionStats[actionType] ?? { attempts: 0, avgReward: 0 };
        stats.attempts += 1;
        history.actionStats[actionType] = stats;

        await history.save();
    }
}

