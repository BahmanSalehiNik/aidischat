import mongoose from "mongoose";

export interface TrainingJobDoc extends mongoose.Document {
    agentId: string;
    datasetId: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    createdAt: Date;
    startedAt?: Date;
    finishedAt?: Date;
    retries: number;
    errorMessage?: string;
}

const trainingJobSchema = new mongoose.Schema<TrainingJobDoc>({
    agentId: { type: String, required: true, index: true },
    datasetId: { type: String, required: true },
    status: { type: String, enum: ['pending', 'running', 'completed', 'failed'], default: 'pending' },
    startedAt: Date,
    finishedAt: Date,
    retries: { type: Number, default: 0 },
    errorMessage: String
}, {
    timestamps: true,
    versionKey: false
});

trainingJobSchema.index({ agentId: 1, createdAt: -1 });

export const TrainingJob = mongoose.model<TrainingJobDoc>("TrainingJob", trainingJobSchema);

