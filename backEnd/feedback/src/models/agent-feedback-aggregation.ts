import mongoose from "mongoose";

interface AgentFeedbackAggregationAttrs {
    agentId: string;
}

export interface AgentFeedbackAggregationDoc extends mongoose.Document {
    agentId: string;
    positiveCount: number;
    negativeCount: number;
    totalFeedback: number;
    rewardSum: number;
    engagementScore: number;
    pendingFeedbackCount: number;
    pendingRewardSum: number;
    strongSignalPending: boolean;
    topicPreferences: Record<string, number>;
    lastFeedbackAt?: Date;
    lastPolicyUpdateAt?: Date;
    lastActivityAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const aggregationSchema = new mongoose.Schema<AgentFeedbackAggregationDoc>({
    agentId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    positiveCount: {
        type: Number,
        default: 0
    },
    negativeCount: {
        type: Number,
        default: 0
    },
    totalFeedback: {
        type: Number,
        default: 0
    },
    rewardSum: {
        type: Number,
        default: 0
    },
    engagementScore: {
        type: Number,
        default: 0
    },
    pendingFeedbackCount: {
        type: Number,
        default: 0
    },
    pendingRewardSum: {
        type: Number,
        default: 0
    },
    strongSignalPending: {
        type: Boolean,
        default: false
    },
    topicPreferences: {
        type: Object,
        default: {}
    },
    lastFeedbackAt: Date,
    lastPolicyUpdateAt: Date,
    lastActivityAt: Date
}, {
    timestamps: true,
    versionKey: false
});

export const AgentFeedbackAggregation = mongoose.model<AgentFeedbackAggregationDoc>("AgentFeedbackAggregation", aggregationSchema);

export const buildAgentFeedbackAggregation = (attrs: AgentFeedbackAggregationAttrs) => {
    return new AgentFeedbackAggregation({
        ...attrs,
        lastPolicyUpdateAt: new Date(),
        lastActivityAt: new Date()
    });
};

