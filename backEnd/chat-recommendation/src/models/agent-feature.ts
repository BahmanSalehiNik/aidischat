import mongoose from 'mongoose';

export enum AgentProvisioningStatus {
  Pending = 'pending',
  Active = 'active',
  Failed = 'failed',
}

interface AgentFeatureAttrs {
  agentId: string;
  name: string;
  displayName?: string;
  tags: string[];
  skills: string[];
  specialization?: string;
  profession?: string;
  popularity: number;
  rating: number;
  embeddings?: number[];
  isActive: boolean; // Deprecated: Use provisioningStatus instead
  provisioningStatus: AgentProvisioningStatus; // NEW: Actual provisioning status
  isPublic: boolean;
  language?: string; // Language code (e.g., "en", "es")
  lastUpdatedAt: Date;
}

interface AgentFeatureDoc extends mongoose.Document {
  agentId: string;
  name: string;
  displayName?: string;
  tags: string[];
  skills: string[];
  specialization?: string;
  profession?: string;
  popularity: number;
  rating: number;
  embeddings?: number[];
  isActive: boolean; // Deprecated: Use provisioningStatus instead
  provisioningStatus: AgentProvisioningStatus; // NEW: Actual provisioning status
  isPublic: boolean;
  language?: string;
  lastUpdatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface AgentFeatureModel extends mongoose.Model<AgentFeatureDoc> {
  build(attrs: AgentFeatureAttrs): AgentFeatureDoc;
}

const agentFeatureSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  agentId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  displayName: { type: String },
  tags: [{ type: String, index: true }],
  skills: [{ type: String }],
  specialization: { type: String, index: true },
  profession: { type: String },
  popularity: { type: Number, default: 0, index: true },
  rating: { type: Number, default: 0, min: 0, max: 5 },
  embeddings: [{ type: Number }],
  isActive: { type: Boolean, default: true, index: true }, // Deprecated: Use provisioningStatus
  provisioningStatus: { 
    type: String, 
    enum: Object.values(AgentProvisioningStatus), 
    default: AgentProvisioningStatus.Pending,
    index: true,
    required: true,
  },
  isPublic: { type: Boolean, default: true, index: true },
  language: { type: String, index: true },
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

// Compound indexes for common queries
agentFeatureSchema.index({ tags: 1, provisioningStatus: 1, isPublic: 1 });
agentFeatureSchema.index({ specialization: 1, provisioningStatus: 1 });
agentFeatureSchema.index({ language: 1, provisioningStatus: 1, isPublic: 1 });
// Keep isActive index for backward compatibility during migration
agentFeatureSchema.index({ tags: 1, isActive: 1, isPublic: 1 });

agentFeatureSchema.statics.build = (attrs: AgentFeatureAttrs) => {
  return new AgentFeature({ _id: attrs.agentId, ...attrs });
};

export const AgentFeature = mongoose.model<AgentFeatureDoc, AgentFeatureModel>(
  'AgentFeature',
  agentFeatureSchema
);

