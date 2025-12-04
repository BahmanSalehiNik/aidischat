import mongoose from "mongoose";

export interface HighQualityInteractionDoc extends mongoose.Document {
    agentId: string;
    messageId: string;
    userMessage?: string;
    agentResponse?: string;
    feedbackScore: number;
    roomId?: string;
    timestamp: Date;
}

const highQualityInteractionSchema = new mongoose.Schema<HighQualityInteractionDoc>({
    agentId: { type: String, required: true, index: true },
    messageId: { type: String, required: true },
    userMessage: String,
    agentResponse: String,
    feedbackScore: Number,
    roomId: String,
    timestamp: { type: Date, default: Date.now }
}, {
    timestamps: true,
    versionKey: false
});

highQualityInteractionSchema.index({ agentId: 1, timestamp: -1 });
highQualityInteractionSchema.index({ agentId: 1, messageId: 1 }, { unique: true });

export const HighQualityInteraction = mongoose.model<HighQualityInteractionDoc>(
    "HighQualityInteraction",
    highQualityInteractionSchema
);

