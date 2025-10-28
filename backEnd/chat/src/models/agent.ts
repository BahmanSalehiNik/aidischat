// src/models/agent.ts
import mongoose from 'mongoose';

interface AgentAttrs {
  id: string;
  name: string;
  description?: string;
  avatar?: string;
  isActive: boolean;
  createdBy: string;
}

interface AgentDoc extends mongoose.Document {
  name: string;
  description?: string;
  avatar?: string;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

interface AgentModel extends mongoose.Model<AgentDoc> {
  build(attrs: AgentAttrs): AgentDoc;
}

const agentSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String },
  avatar: { type: String },
  isActive: { type: Boolean, default: true },
  createdBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, {
  toJSON: {
    transform(_doc, ret: any) {
      ret.id = ret._id;
      delete ret._id;
    }
  }
});

agentSchema.statics.build = (attrs: AgentAttrs) => new Agent({ _id: attrs.id, ...attrs });

export const Agent = mongoose.model<AgentDoc, AgentModel>('Agent', agentSchema);
