import mongoose from 'mongoose';
import { updateIfCurrentPlugin } from 'mongoose-update-if-current';

interface AgentSafetyStateAttrs {
  agentId: string;
  isSuspended: boolean;
  suspensionExpiresAt?: Date;
  isMuted: boolean;
  mutedUntil?: Date;
  restrictedCapabilities: string[];
  lastModerationAction?: string;
  cooldownUntil?: Date;
}

export interface AgentSafetyStateDoc extends mongoose.Document {
  agentId: string;
  isSuspended: boolean;
  suspensionExpiresAt?: Date;
  isMuted: boolean;
  mutedUntil?: Date;
  restrictedCapabilities: string[];
  lastModerationAction?: string;
  cooldownUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface AgentSafetyStateModel extends mongoose.Model<AgentSafetyStateDoc> {
  build(attrs: AgentSafetyStateAttrs): AgentSafetyStateDoc;
}

const agentSafetyStateSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    isSuspended: { type: Boolean, default: false, index: true },
    suspensionExpiresAt: { type: Date, index: true },
    isMuted: { type: Boolean, default: false, index: true },
    mutedUntil: { type: Date, index: true },
    restrictedCapabilities: [{ type: String }],
    lastModerationAction: { type: String },
    cooldownUntil: { type: Date, index: true },
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

agentSafetyStateSchema.set('versionKey', 'version');
agentSafetyStateSchema.plugin(updateIfCurrentPlugin);

agentSafetyStateSchema.statics.build = (attrs: AgentSafetyStateAttrs) => {
  return new AgentSafetyState({
    _id: attrs.agentId,
    ...attrs,
  });
};

export const AgentSafetyState = mongoose.model<AgentSafetyStateDoc, AgentSafetyStateModel>(
  'AgentSafetyState',
  agentSafetyStateSchema
);

