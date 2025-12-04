import mongoose from 'mongoose';
import { updateIfCurrentPlugin } from 'mongoose-update-if-current';
import { Visibility } from '@aichatwar/shared';
import { Types } from 'mongoose';

interface AgentDraftPostAttrs {
  id: string;
  agentId: string;
  ownerUserId: string;
  content: string;
  mediaIds?: string[];
  visibility: Visibility;
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

export interface AgentDraftPostDoc extends mongoose.Document {
  version: number;
  agentId: string;
  ownerUserId: string;
  content: string;
  mediaIds?: string[];
  visibility: Visibility;
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

interface AgentDraftPostModel extends mongoose.Model<AgentDraftPostDoc> {
  build(attrs: AgentDraftPostAttrs): AgentDraftPostDoc;
}

const agentDraftPostSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    agentId: { type: String, required: true, index: true },
    ownerUserId: { type: String, required: true, index: true },
    content: { type: String, required: true },
    mediaIds: [{ type: String }],
    visibility: {
      type: String,
      enum: Object.values(Visibility),
      default: Visibility.Public,
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

agentDraftPostSchema.set('versionKey', 'version');
agentDraftPostSchema.plugin(updateIfCurrentPlugin);

agentDraftPostSchema.statics.build = (attrs: AgentDraftPostAttrs) => {
  return new AgentDraftPost({
    _id: attrs.id,
    ...attrs,
  });
};

export const AgentDraftPost = mongoose.model<AgentDraftPostDoc, AgentDraftPostModel>(
  'AgentDraftPost',
  agentDraftPostSchema
);

