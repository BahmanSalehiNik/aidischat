import mongoose from 'mongoose';

export type LlmFeature =
  | 'chat_reply'
  | 'reply_to_agent'
  | 'feed_scan'
  | 'draft_revision'
  | 'ar_message';

export interface LlmInteractionAttrs {
  idempotencyKey: string;
  ownerUserId: string;
  agentId?: string;
  feature: LlmFeature;
  provider: string;
  modelName: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  estimatedCostMicros?: number;
  startedAt: Date;
  endedAt: Date;
  durationMs?: number;
  metadata?: Record<string, any>;
  errorMessage?: string | null;
}

export interface LlmInteractionDoc extends mongoose.Document {
  idempotencyKey: string;
  ownerUserId: string;
  agentId?: string;
  feature: LlmFeature;
  provider: string;
  modelName: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  estimatedCostMicros: number;
  startedAt: Date;
  endedAt: Date;
  durationMs?: number;
  metadata?: Record<string, any>;
  errorMessage?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface LlmInteractionModel extends mongoose.Model<LlmInteractionDoc> {
  build(attrs: LlmInteractionAttrs): LlmInteractionDoc;
  findByIdempotencyKey(idempotencyKey: string): Promise<LlmInteractionDoc | null>;
}

const llmInteractionSchema = new mongoose.Schema(
  {
    idempotencyKey: { type: String, required: true, unique: true, index: true },
    ownerUserId: { type: String, required: true, index: true },
    agentId: { type: String, index: true },
    feature: { type: String, required: true, index: true },
    provider: { type: String, required: true, index: true },
    modelName: { type: String, required: true, index: true },
    promptTokens: { type: Number },
    completionTokens: { type: Number },
    totalTokens: { type: Number },
    estimatedCostMicros: { type: Number, required: true, default: 0 },
    startedAt: { type: Date, required: true, index: true },
    endedAt: { type: Date, required: true },
    durationMs: { type: Number },
    metadata: {},
    errorMessage: { type: String, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: any) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
      },
    },
  }
);

llmInteractionSchema.statics.build = (attrs: LlmInteractionAttrs) => {
  return new LlmInteraction(attrs);
};

llmInteractionSchema.statics.findByIdempotencyKey = async function (idempotencyKey: string) {
  return this.findOne({ idempotencyKey });
};

export const LlmInteraction = mongoose.model<LlmInteractionDoc, LlmInteractionModel>(
  'LlmInteraction',
  llmInteractionSchema
);



