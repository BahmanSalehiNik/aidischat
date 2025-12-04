import mongoose from 'mongoose';
import { updateIfCurrentPlugin } from 'mongoose-update-if-current';

interface ModerationActionAttrs {
  id: string;
  agentId: string;
  actionType: 'suspended' | 'muted' | 'forceLeaveRoom' | 'contentBlocked';
  reason: string;
  duration?: number; // hours
  appliedAt: Date;
  appliedBy: string; // Moderator user ID
  status: 'active' | 'expired' | 'appealed';
  roomId?: string; // For forceLeaveRoom
  contentId?: string; // For contentBlocked
  contentType?: 'post' | 'comment' | 'reaction' | 'draft'; // For contentBlocked
}

export interface ModerationActionDoc extends mongoose.Document {
  id: string;
  agentId: string;
  actionType: 'suspended' | 'muted' | 'forceLeaveRoom' | 'contentBlocked';
  reason: string;
  duration?: number;
  appliedAt: Date;
  appliedBy: string;
  status: 'active' | 'expired' | 'appealed';
  roomId?: string;
  contentId?: string;
  contentType?: 'post' | 'comment' | 'reaction' | 'draft';
  createdAt: Date;
  updatedAt: Date;
}

interface ModerationActionModel extends mongoose.Model<ModerationActionDoc> {
  build(attrs: ModerationActionAttrs): ModerationActionDoc;
}

const moderationActionSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    agentId: { type: String, required: true, index: true },
    actionType: {
      type: String,
      enum: ['suspended', 'muted', 'forceLeaveRoom', 'contentBlocked'],
      required: true,
      index: true,
    },
    reason: { type: String, required: true },
    duration: { type: Number }, // hours
    appliedAt: { type: Date, required: true, default: Date.now },
    appliedBy: { type: String, required: true },
    status: {
      type: String,
      enum: ['active', 'expired', 'appealed'],
      default: 'active',
      index: true,
    },
    roomId: { type: String },
    contentId: { type: String },
    contentType: {
      type: String,
      enum: ['post', 'comment', 'reaction', 'draft'],
    },
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

moderationActionSchema.set('versionKey', 'version');
moderationActionSchema.plugin(updateIfCurrentPlugin);

moderationActionSchema.statics.build = (attrs: ModerationActionAttrs) => {
  return new ModerationAction({
    _id: attrs.id,
    ...attrs,
  });
};

export const ModerationAction = mongoose.model<ModerationActionDoc, ModerationActionModel>(
  'ModerationAction',
  moderationActionSchema
);

