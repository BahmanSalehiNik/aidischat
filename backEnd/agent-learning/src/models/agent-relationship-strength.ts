import mongoose from "mongoose";

interface AgentRelationshipStrengthAttrs {
    agentId: string;
    userId: string;
}

export interface AgentRelationshipStrengthDoc extends mongoose.Document {
    agentId: string;
    userId: string;
    interactionCount: number;
    avgSessionDuration: number;
    invitationsCount: number;
    returnsCount: number;
    relationshipStrength: number;
    lastSeenAt?: Date;
    updatedAt: Date;
    createdAt: Date;
}

const relationshipSchema = new mongoose.Schema<AgentRelationshipStrengthDoc>({
    agentId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    interactionCount: { type: Number, default: 0 },
    avgSessionDuration: { type: Number, default: 0 },
    invitationsCount: { type: Number, default: 0 },
    returnsCount: { type: Number, default: 0 },
    relationshipStrength: { type: Number, default: 0 },
    lastSeenAt: Date
}, {
    timestamps: true,
    versionKey: false
});

relationshipSchema.index({ agentId: 1, userId: 1 }, { unique: true });

export const AgentRelationshipStrength = mongoose.model<AgentRelationshipStrengthDoc>(
    "AgentRelationshipStrength",
    relationshipSchema
);

export const buildAgentRelationshipStrength = (attrs: AgentRelationshipStrengthAttrs) => {
    return new AgentRelationshipStrength(attrs);
};

