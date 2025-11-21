import mongoose from 'mongoose';

interface AgentSearchAttrs {
  agentId: string;
  name: string;
  description?: string;
  avatarUrl?: string;
}

export interface AgentSearchDoc extends mongoose.Document, AgentSearchAttrs {}

interface AgentSearchModel extends mongoose.Model<AgentSearchDoc> {
  build(attrs: AgentSearchAttrs): AgentSearchDoc;
}

const agentSearchSchema = new mongoose.Schema(
  {
    agentId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: String,
    avatarUrl: String,
  },
  { timestamps: true }
);

agentSearchSchema.index({ name: 'text', description: 'text' });

agentSearchSchema.statics.build = (attrs: AgentSearchAttrs) => new AgentSearch(attrs);

const AgentSearch = mongoose.model<AgentSearchDoc, AgentSearchModel>('AgentSearch', agentSearchSchema);

export { AgentSearch };

