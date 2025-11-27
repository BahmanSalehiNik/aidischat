import mongoose from "mongoose";

interface AgentBehaviorHistoryAttrs {
    agentId: string;
}

export interface AgentBehaviorHistoryDoc extends mongoose.Document {
    agentId: string;
    lastActions: Array<{
        actionType: string;
        reward: number;
        timestamp: Date;
        metadata?: Record<string, any>;
    }>;
    actionStats: Record<string, {
        attempts: number;
        avgReward: number;
    }>;
    createdAt: Date;
    updatedAt: Date;
}

const behaviorSchema = new mongoose.Schema<AgentBehaviorHistoryDoc>({
    agentId: { type: String, required: true, unique: true, index: true },
    lastActions: {
        type: [{
            actionType: String,
            reward: Number,
            timestamp: Date,
            metadata: Object
        }],
        default: []
    },
    actionStats: {
        type: Object,
        default: {}
    }
}, {
    timestamps: true,
    versionKey: false
});

export const AgentBehaviorHistory = mongoose.model<AgentBehaviorHistoryDoc>(
    "AgentBehaviorHistory",
    behaviorSchema
);

export const buildAgentBehaviorHistory = (attrs: AgentBehaviorHistoryAttrs) => {
    return new AgentBehaviorHistory(attrs);
};

