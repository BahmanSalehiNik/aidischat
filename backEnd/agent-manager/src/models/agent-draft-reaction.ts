import mongoose from 'mongoose';
import { updateIfCurrentPlugin } from 'mongoose-update-if-current';

interface AgentDraftReactionAttrs {
  id: string;
  agentId: string;
  ownerUserId: string;
  targetType: 'post' | 'comment';
  targetId: string;
  reactionType: 'like' | 'love' | 'haha' | 'sad' | 'angry';
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  expiresAt: Date;
  approvedAt?: Date;
  rejectedAt?: Date;
  rejectionReason?: string;
  metadata?: {
    suggestedBy: 'activity_worker' | 'manual' | 'ai_gateway';
    confidence?: number;
    context?: string;
  };
}

export interface AgentDraftReactionDoc extends mongoose.Document {
  version: number;
  agentId: string;
  ownerUserId: string;
  targetType: 'post' | 'comment';
  targetId: string;
  reactionType: 'like' | 'love' | 'haha' | 'sad' | 'angry';
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  approvedAt?: Date;
  rejectedAt?: Date;
  rejectionReason?: string;
  metadata?: {
    suggestedBy: 'activity_worker' | 'manual' | 'ai_gateway';
    confidence?: number;
    context?: string;
  };
}

interface AgentDraftReactionModel extends mongoose.Model<AgentDraftReactionDoc> {
  build(attrs: AgentDraftReactionAttrs): AgentDraftReactionDoc;
}

const agentDraftReactionSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    agentId: { type: String, required: true, index: true },
    ownerUserId: { type: String, required: true, index: true },
    targetType: {
      type: String,
      enum: ['post', 'comment'],
      required: true,
      index: true,
    },
    targetId: { type: String, required: true, index: true },
    reactionType: {
      type: String,
      enum: ['like', 'love', 'haha', 'sad', 'angry'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'expired'],
      default: 'pending',
      index: true,
    },
    expiresAt: { type: Date, required: true, index: true },
    approvedAt: { type: Date },
    rejectedAt: { type: Date },
    rejectionReason: { type: String },
    metadata: { type: Object },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret: any) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
      },
    },
  }
);

agentDraftReactionSchema.set('versionKey', 'version');
agentDraftReactionSchema.plugin(updateIfCurrentPlugin);

agentDraftReactionSchema.statics.build = (attrs: AgentDraftReactionAttrs) => {
  return new AgentDraftReaction({
    _id: attrs.id,
    ...attrs,
  });
};

export const AgentDraftReaction = mongoose.model<AgentDraftReactionDoc, AgentDraftReactionModel>(
  'AgentDraftReaction',
  agentDraftReactionSchema
);

