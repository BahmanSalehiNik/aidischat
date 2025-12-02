import mongoose from 'mongoose';
import { updateIfCurrentPlugin } from 'mongoose-update-if-current';

export enum AgentProvisioningStatus {
  Pending = 'pending',
  Active = 'active',
  Failed = 'failed',
}

interface AgentAttrs {
  id: string;
  ownerUserId: string;
  version: number;
  status?: AgentProvisioningStatus;
  provisioningCorrelationId?: string;
  agentProfileId?: string;
  provider?: string;
  providerAgentId?: string;
  provisioningError?: string | null;
  provisionedAt?: Date;
  lastProvisioningFailedAt?: Date;
  // Model configuration
  modelProvider?: string;
  modelName?: string;
  systemPrompt?: string;
  tools?: { name: string; config: any }[];
  voiceId?: string;
  memory?: any;
  rateLimits?: { rpm: number; tpm: number };
  privacy?: { shareMessagesWithOwner: boolean };
  deletedAt?: Date;
  isDeleted?: boolean;
}

export interface AgentDoc extends mongoose.Document {
  ownerUserId: string;
  version: number;
  deletedAt?: Date;
  isDeleted: boolean;
  status: AgentProvisioningStatus;
  provider?: string;
  providerAgentId?: string;
  provisioningCorrelationId?: string;
  provisioningError?: string | null;
  provisionedAt?: Date;
  lastProvisioningFailedAt?: Date;
  agentProfileId?: string;
  // Model configuration
  modelProvider: string;
  modelName: string;
  systemPrompt: string;
  tools: { name: string; config: any }[];
  voiceId: string;
  memory: any;
  rateLimits: { rpm: number; tpm: number };
  privacy: { shareMessagesWithOwner: boolean };
  createdAt: Date;
  updatedAt: Date;
}

interface AgentModel extends mongoose.Model<AgentDoc> {
  build(attrs: AgentAttrs): AgentDoc;
  findByEvent(e: { id: string; version: number }): Promise<AgentDoc | null>;
}

const agentSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    ownerUserId: { type: String, required: true, index: true },
    version: { type: Number, required: true, default: 0 },
    deletedAt: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false, index: true },
    status: {
      type: String,
      enum: Object.values(AgentProvisioningStatus),
      default: AgentProvisioningStatus.Pending,
      index: true,
    },
    provider: { type: String },
    providerAgentId: { type: String },
    provisioningCorrelationId: { type: String, index: true },
    provisioningError: { type: String, default: null },
    provisionedAt: { type: Date },
    lastProvisioningFailedAt: { type: Date },
    agentProfileId: { type: String, index: true, default: null },
    // Model configuration
    modelProvider: { 
      type: String, 
      enum: ['openai','anthropic','cohere','local','custom'], 
      default: 'openai' 
    },
    modelName: { type: String, default: 'gpt-4o' },
    systemPrompt: { type: String, default: '' },
    tools: { type: [{ name: String, config: {} }], default: [] },
    voiceId: { type: String, default: '' },
    memory: { type: {}, default: {} },
    rateLimits: { 
      rpm: { type: Number, default: 60 }, 
      tpm: { type: Number, default: 1000 } 
    },
    privacy: { 
      shareMessagesWithOwner: { type: Boolean, default: true } 
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

agentSchema.set('versionKey', 'version');
agentSchema.plugin(updateIfCurrentPlugin);

agentSchema.statics.build = function (attrs: AgentAttrs) {
  return new Agent({
    _id: attrs.id,
    ownerUserId: attrs.ownerUserId,
    version: attrs.version,
    status: attrs.status ?? AgentProvisioningStatus.Pending,
    provisioningCorrelationId: attrs.provisioningCorrelationId,
    agentProfileId: attrs.agentProfileId,
    provider: attrs.provider,
    providerAgentId: attrs.providerAgentId,
    provisioningError: attrs.provisioningError,
    provisionedAt: attrs.provisionedAt,
    lastProvisioningFailedAt: attrs.lastProvisioningFailedAt,
    modelProvider: attrs.modelProvider ?? 'openai',
    modelName: attrs.modelName ?? 'gpt-4o',
    systemPrompt: attrs.systemPrompt ?? '',
    tools: attrs.tools ?? [],
    voiceId: attrs.voiceId ?? '',
    memory: attrs.memory ?? {},
    rateLimits: attrs.rateLimits ?? { rpm: 60, tpm: 1000 },
    privacy: attrs.privacy ?? { shareMessagesWithOwner: true },
    deletedAt: attrs.deletedAt,
    isDeleted: attrs.isDeleted ?? false,
  });
};

agentSchema.statics.findByEvent = function (e: { id: string; version: number }) {
  return this.findOne({ _id: e.id, version: e.version - 1 });
};

export const Agent = mongoose.model<AgentDoc, AgentModel>('Agent', agentSchema);

