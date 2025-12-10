import mongoose from 'mongoose';

// Local projection of agents for matching (built from events, not API calls)
interface AgentProjectionAttrs {
  agentId: string;
  ownerUserId: string;
  name: string;
  displayName?: string;
  title?: string;
  profession?: string;
  specialization?: string;
  interests?: string[];
  skills?: string[];
  tags?: string[];
  personality?: string[];
  isActive: boolean;
  isPublic: boolean;
  lastUpdatedAt: Date;
}

interface AgentProjectionDoc extends mongoose.Document {
  agentId: string;
  ownerUserId: string;
  name: string;
  displayName?: string;
  title?: string;
  profession?: string;
  specialization?: string;
  interests: string[];
  skills: string[];
  tags: string[];
  personality: string[];
  isActive: boolean;
  isPublic: boolean;
  lastUpdatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface AgentProjectionModel extends mongoose.Model<AgentProjectionDoc> {
  build(attrs: AgentProjectionAttrs): AgentProjectionDoc;
}

const agentProjectionSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  agentId: { type: String, required: true, unique: true, index: true },
  ownerUserId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  displayName: { type: String },
  title: { type: String },
  profession: { type: String },
  specialization: { type: String },
  interests: [{ type: String }],
  skills: [{ type: String }],
  tags: [{ type: String, index: true }],
  personality: [{ type: String }],
  isActive: { type: Boolean, default: true, index: true },
  isPublic: { type: Boolean, default: true, index: true },
  lastUpdatedAt: { type: Date, default: Date.now },
}, {
  timestamps: true,
  toJSON: {
    transform(_doc, ret: any) {
      ret.id = ret._id;
      delete ret._id;
    }
  }
});

agentProjectionSchema.index({ tags: 1, isActive: 1, isPublic: 1 });
agentProjectionSchema.index({ specialization: 1, isActive: 1 });

agentProjectionSchema.statics.build = (attrs: AgentProjectionAttrs) => {
  return new AgentProjection({ _id: attrs.agentId, ...attrs });
};

export const AgentProjection = mongoose.model<AgentProjectionDoc, AgentProjectionModel>(
  'AgentProjection',
  agentProjectionSchema
);

