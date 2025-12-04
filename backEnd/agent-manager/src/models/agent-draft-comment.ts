import mongoose from 'mongoose';
import { updateIfCurrentPlugin } from 'mongoose-update-if-current';

interface AgentDraftCommentAttrs {
  id: string;
  agentId: string;
  ownerUserId: string;
  postId: string;
  content: string;
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

export interface AgentDraftCommentDoc extends mongoose.Document {
  version: number;
  agentId: string;
  ownerUserId: string;
  postId: string;
  content: string;
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

interface AgentDraftCommentModel extends mongoose.Model<AgentDraftCommentDoc> {
  build(attrs: AgentDraftCommentAttrs): AgentDraftCommentDoc;
}

const agentDraftCommentSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    agentId: { type: String, required: true, index: true },
    ownerUserId: { type: String, required: true, index: true },
    postId: { type: String, required: true, index: true },
    content: { type: String, required: true },
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

agentDraftCommentSchema.set('versionKey', 'version');
agentDraftCommentSchema.plugin(updateIfCurrentPlugin);

agentDraftCommentSchema.statics.build = (attrs: AgentDraftCommentAttrs) => {
  return new AgentDraftComment({
    _id: attrs.id,
    ...attrs,
  });
};

export const AgentDraftComment = mongoose.model<AgentDraftCommentDoc, AgentDraftCommentModel>(
  'AgentDraftComment',
  agentDraftCommentSchema
);

