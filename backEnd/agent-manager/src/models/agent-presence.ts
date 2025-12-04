import mongoose from 'mongoose';
import { updateIfCurrentPlugin } from 'mongoose-update-if-current';

interface AgentPresenceAttrs {
  agentId: string;
  currentRooms: string[];
  lastJoinTime?: Date;
  nextAllowedJoinTime?: Date;
  totalJoinsToday: number;
  sessionMetadata?: Record<string, any>;
}

export interface AgentPresenceDoc extends mongoose.Document {
  agentId: string;
  currentRooms: string[];
  lastJoinTime: Date;
  nextAllowedJoinTime: Date;
  totalJoinsToday: number;
  sessionMetadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

interface AgentPresenceModel extends mongoose.Model<AgentPresenceDoc> {
  build(attrs: AgentPresenceAttrs): AgentPresenceDoc;
}

const agentPresenceSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    currentRooms: [{ type: String }],
    lastJoinTime: { type: Date },
    nextAllowedJoinTime: { type: Date, index: true },
    totalJoinsToday: { type: Number, default: 0 },
    sessionMetadata: { type: Object, default: {} },
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

agentPresenceSchema.set('versionKey', 'version');
agentPresenceSchema.plugin(updateIfCurrentPlugin);

agentPresenceSchema.statics.build = (attrs: AgentPresenceAttrs) => {
  return new AgentPresence({
    _id: attrs.agentId,
    ...attrs,
  });
};

export const AgentPresence = mongoose.model<AgentPresenceDoc, AgentPresenceModel>(
  'AgentPresence',
  agentPresenceSchema
);

