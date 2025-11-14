// src/models/agent-profile.ts
// This model represents the agent profile data needed by AI gateway
// It will be populated from events or direct queries to agents service
import mongoose from 'mongoose';

export enum AgentProfileStatus {
  Pending = 'pending',
  Active = 'active',
  Failed = 'failed',
}

export interface AgentProfileAttrs {
  agentId: string;
  ownerUserId: string;
  version: number;
  correlationId: string;
  ingestedAt: Date;
  status?: AgentProfileStatus;
  modelProvider: string;
  modelName: string;
  systemPrompt: string;
  tools?: { name: string; config: any }[];
  apiKey?: string; // Provider-specific API key (if needed)
  endpoint?: string; // For local/custom providers
  rateLimits?: { rpm: number; tpm: number };
  voiceId?: string;
  memory?: any;
  privacy?: { shareMessagesWithOwner: boolean };
  metadata?: Record<string, any>;
}

export interface AgentProfileDoc extends mongoose.Document {
  agentId: string;
  ownerUserId: string;
  version: number;
  correlationId: string;
  ingestedAt: Date;
  status: AgentProfileStatus;
  modelProvider: string;
  modelName: string;
  systemPrompt: string;
  tools: { name: string; config: any }[];
  apiKey?: string;
  endpoint?: string;
  rateLimits?: { rpm: number; tpm: number };
  voiceId?: string;
  memory?: any;
  privacy?: { shareMessagesWithOwner: boolean };
  metadata?: Record<string, any>;
  providerAgentId?: string;
  provider?: string;
  lastProvisioningError?: string | null;
  updatedAt: Date;
  createdAt: Date;
}

interface AgentProfileModel extends mongoose.Model<AgentProfileDoc> {
  build(attrs: AgentProfileAttrs): AgentProfileDoc;
  findByAgentId(agentId: string): Promise<AgentProfileDoc | null>;
  upsertFromIngestion(attrs: AgentProfileAttrs): Promise<AgentProfileDoc>;
}

const agentProfileSchema = new mongoose.Schema(
  {
    agentId: { type: String, required: true, index: true, unique: true },
    ownerUserId: { type: String, required: true, index: true },
    version: { type: Number, required: true, default: 0 },
    correlationId: { type: String, required: true },
    ingestedAt: { type: Date, required: true },
    status: {
      type: String,
      enum: Object.values(AgentProfileStatus),
      default: AgentProfileStatus.Pending,
      index: true,
    },
    modelProvider: { type: String, enum: ['openai', 'anthropic', 'cohere', 'local', 'custom'], required: true },
    modelName: { type: String, required: true },
    systemPrompt: { type: String, default: '' },
    tools: [{ name: String, config: {} }],
    apiKey: { type: String }, // Encrypted in production
    endpoint: { type: String }, // For local/custom providers
    rateLimits: { rpm: Number, tpm: Number },
    voiceId: { type: String },
    memory: {},
    privacy: {},
    metadata: {},
    providerAgentId: { type: String },
    provider: { type: String },
    lastProvisioningError: { type: String, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: any) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        // Don't expose API keys in JSON
        delete ret.apiKey;
      },
    },
  }
);

agentProfileSchema.statics.build = (attrs: AgentProfileAttrs) => {
  return new AgentProfile(attrs);
};

agentProfileSchema.statics.findByAgentId = async function (agentId: string) {
  return this.findOne({ agentId });
};

agentProfileSchema.statics.upsertFromIngestion = async function (attrs: AgentProfileAttrs) {
  const existing = await this.findOne({ agentId: attrs.agentId });
  if (existing) {
    existing.set({
      ownerUserId: attrs.ownerUserId,
      version: attrs.version,
      correlationId: attrs.correlationId,
      ingestedAt: attrs.ingestedAt,
      status: attrs.status ?? AgentProfileStatus.Pending,
      modelProvider: attrs.modelProvider,
      modelName: attrs.modelName,
      systemPrompt: attrs.systemPrompt,
      tools: attrs.tools ?? [],
      rateLimits: attrs.rateLimits,
      voiceId: attrs.voiceId,
      memory: attrs.memory,
      privacy: attrs.privacy,
      metadata: attrs.metadata,
    });
    await existing.save();
    return existing;
  }

  const profile = AgentProfile.build({
    ...attrs,
    status: attrs.status ?? AgentProfileStatus.Pending,
  });
  await profile.save();
  return profile;
};

export const AgentProfile = mongoose.model<AgentProfileDoc, AgentProfileModel>(
  'AgentProfile',
  agentProfileSchema
);

