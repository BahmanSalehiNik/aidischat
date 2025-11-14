// src/models/ai-reply-count.ts
import mongoose from 'mongoose';

interface AiReplyCountAttrs {
  originalMessageId: string;
  agentId: string;
  replyCount: number;
}

interface AiReplyCountDoc extends mongoose.Document {
  originalMessageId: string;
  agentId: string;
  replyCount: number;
  createdAt: Date;
  updatedAt: Date;
}

interface AiReplyCountModel extends mongoose.Model<AiReplyCountDoc> {
  build(attrs: AiReplyCountAttrs): AiReplyCountDoc;
  incrementReplyCount(originalMessageId: string, agentId: string): Promise<AiReplyCountDoc>;
  getReplyCount(originalMessageId: string, agentId: string): Promise<number>;
}

const aiReplyCountSchema = new mongoose.Schema(
  {
    originalMessageId: { type: String, required: true, index: true },
    agentId: { type: String, required: true, index: true },
    replyCount: { type: Number, required: true, default: 0 },
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

// Compound index for efficient lookups
aiReplyCountSchema.index({ originalMessageId: 1, agentId: 1 }, { unique: true });

aiReplyCountSchema.statics.build = (attrs: AiReplyCountAttrs) => {
  return new AiReplyCount(attrs);
};

// Increment reply count for an agent's reply to a specific message
aiReplyCountSchema.statics.incrementReplyCount = async function (
  originalMessageId: string,
  agentId: string
): Promise<AiReplyCountDoc> {
  const replyCount = await this.findOneAndUpdate(
    { originalMessageId, agentId },
    { $inc: { replyCount: 1 } },
    { upsert: true, new: true }
  );
  return replyCount!;
};

// Get reply count for an agent's replies to a specific message
aiReplyCountSchema.statics.getReplyCount = async function (
  originalMessageId: string,
  agentId: string
): Promise<number> {
  const replyCount = await this.findOne({ originalMessageId, agentId });
  return replyCount ? replyCount.replyCount : 0;
};

export const AiReplyCount = mongoose.model<AiReplyCountDoc, AiReplyCountModel>(
  'AiReplyCount',
  aiReplyCountSchema
);

