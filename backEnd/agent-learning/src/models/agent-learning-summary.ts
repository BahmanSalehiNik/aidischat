import mongoose from "mongoose";

export type TraitName = 'humor' | 'empathy' | 'sarcasm' | 'brevity' | 'curiosity';

interface AgentLearningSummaryAttrs {
    agentId: string;
    ownerUserId: string;
}

export interface AgentLearningSummaryDoc extends mongoose.Document {
    agentId: string;
    ownerUserId: string;
    sentimentScore: number;
    engagementScore: number;
    qualityScore: number;
    traits: Record<TraitName, number>;
    actionPolicy: {
        replyFrequency: {
            dmOwner: number;
            dmOthers: number;
            groupSmall: number;
            groupLarge: number;
        };
        draftPostProbability: number;
        draftCommentProbability: number;
    };
    exploration: {
        epsilon: number;
    };
    learningRates: {
        traitRate: number;
        actionRate: number;
        epsilonRate: number;
    };
    version: number;
    lastPolicyUpdateAt?: Date;
    lastActivityAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const traitDefaults: Record<TraitName, number> = {
    humor: 0.5,
    empathy: 0.6,
    sarcasm: 0.2,
    brevity: 0.5,
    curiosity: 0.5
};

const summarySchema = new mongoose.Schema<AgentLearningSummaryDoc>({
    agentId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    ownerUserId: {
        type: String,
        required: true
    },
    sentimentScore: {
        type: Number,
        default: 0
    },
    engagementScore: {
        type: Number,
        default: 0
    },
    qualityScore: {
        type: Number,
        default: 0
    },
    traits: {
        type: Object,
        default: traitDefaults
    },
    actionPolicy: {
        replyFrequency: {
            dmOwner: { type: Number, default: 0.8 },
            dmOthers: { type: Number, default: 0.55 },
            groupSmall: { type: Number, default: 0.6 },
            groupLarge: { type: Number, default: 0.4 }
        },
        draftPostProbability: { type: Number, default: 0.2 },
        draftCommentProbability: { type: Number, default: 0.15 }
    },
    exploration: {
        epsilon: { type: Number, default: 0.08 }
    },
    learningRates: {
        traitRate: { type: Number, default: 0.07 },
        actionRate: { type: Number, default: 0.05 },
        epsilonRate: { type: Number, default: 0.02 }
    },
    version: {
        type: Number,
        default: 0
    },
    lastPolicyUpdateAt: Date,
    lastActivityAt: Date
}, {
    timestamps: true,
    versionKey: false
});

summarySchema.statics.build = (attrs: AgentLearningSummaryAttrs) => {
    return new AgentLearningSummary({
        ...attrs,
        traits: traitDefaults,
        lastPolicyUpdateAt: new Date(),
        lastActivityAt: new Date()
    });
};

export const AgentLearningSummary = mongoose.model<AgentLearningSummaryDoc>("AgentLearningSummary", summarySchema);

export const buildAgentLearningSummary = (attrs: AgentLearningSummaryAttrs) => {
    return new AgentLearningSummary({
        ...attrs,
        traits: traitDefaults,
        lastPolicyUpdateAt: new Date(),
        lastActivityAt: new Date()
    });
};

export { traitDefaults };

