import mongoose from 'mongoose';

export enum AvatarStatus {
  Pending = 'pending',
  Generating = 'generating',
  Ready = 'ready',
  Failed = 'failed',
}

export enum AvatarModelType {
  ThreeD = '3d',
  Anime = 'anime',
  Hybrid = 'hybrid',
  Live2D = 'live2d',
}

export enum AvatarModelFormat {
  GLB = 'glb',
  GLTF = 'gltf',
  VRM = 'vrm',
  FBX = 'fbx',
  Live2D = 'live2d',
}

export interface AvatarAttrs {
  agentId: string;
  ownerUserId: string;
  
  // Model Metadata
  modelType?: AvatarModelType;
  format?: AvatarModelFormat;
  version?: number;
  
  // Model Files
  modelUrl?: string;
  textureUrls?: string[];
  animationUrls?: string[];
  metadataUrl?: string;
  
  // Model Properties
  polygonCount?: number;
  textureResolution?: number;
  boneCount?: number;
  animationCount?: number;
  
  // Generation Info
  status: AvatarStatus;
  generationStartedAt?: Date;
  generationCompletedAt?: Date;
  generationError?: string;
  
  // Provider Info
  provider?: string; // 'ready-player-me' | 'meshy' | 'kaedim'
  providerModelId?: string;
  
  // Character Description (from LLM)
  characterDescription?: {
    style: string;
    gender?: string;
    species?: string;
    bodyType?: string;
    hair?: { color: string; style: string };
    eyes?: { color: string };
    clothing?: string;
    colorPalette?: string[];
    expressionBaseline?: string;
  };
  
  // Rendering Settings
  rendering?: {
    scale?: number;
    position?: { x: number; y: number; z: number };
    rotation?: { x: number; y: number; z: number };
  };
  
  // Animation Configuration
  animations?: {
    idle?: string;
    talking?: string;
    gestures?: string[];
  };
  
  // Lip-Sync Configuration
  lipSync?: {
    enabled: boolean;
    method?: 'viseme' | 'bone' | 'blendshape';
    visemeMap?: Record<string, string>;
  };
}

export interface AvatarDoc extends mongoose.Document {
  agentId: string;
  ownerUserId: string;
  modelType: AvatarModelType;
  format: AvatarModelFormat;
  version: number;
  modelUrl?: string;
  textureUrls: string[];
  animationUrls: string[];
  metadataUrl?: string;
  polygonCount?: number;
  textureResolution?: number;
  boneCount?: number;
  animationCount?: number;
  status: AvatarStatus;
  generationStartedAt?: Date;
  generationCompletedAt?: Date;
  generationError?: string;
  provider?: string;
  providerModelId?: string;
  characterDescription?: any;
  rendering?: any;
  animations?: any;
  lipSync?: any;
  createdAt: Date;
  updatedAt: Date;
}

interface AvatarModel extends mongoose.Model<AvatarDoc> {
  build(attrs: AvatarAttrs): AvatarDoc;
  findByAgentId(agentId: string): Promise<AvatarDoc | null>;
}

const avatarSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  agentId: { type: String, required: true, index: true, unique: true },
  ownerUserId: { type: String, required: true, index: true },
  
  modelType: {
    type: String,
    enum: Object.values(AvatarModelType),
    default: AvatarModelType.ThreeD,
  },
  format: {
    type: String,
    enum: Object.values(AvatarModelFormat),
    default: AvatarModelFormat.GLB,
  },
  version: { type: Number, default: 1 },
  
  modelUrl: { type: String },
  textureUrls: [{ type: String }],
  animationUrls: [{ type: String }],
  metadataUrl: { type: String },
  
  polygonCount: { type: Number },
  textureResolution: { type: Number },
  boneCount: { type: Number },
  animationCount: { type: Number },
  
  status: {
    type: String,
    enum: Object.values(AvatarStatus),
    default: AvatarStatus.Pending,
    index: true,
  },
  generationStartedAt: { type: Date },
  generationCompletedAt: { type: Date },
  generationError: { type: String },
  
  provider: { type: String },
  providerModelId: { type: String },
  
  characterDescription: { type: mongoose.Schema.Types.Mixed },
  
  rendering: {
    scale: { type: Number, default: 1.0 },
    position: {
      x: { type: Number, default: 0 },
      y: { type: Number, default: 0 },
      z: { type: Number, default: 0 },
    },
    rotation: {
      x: { type: Number, default: 0 },
      y: { type: Number, default: 0 },
      z: { type: Number, default: 0 },
    },
  },
  
  animations: {
    idle: { type: String },
    talking: { type: String },
    gestures: [{ type: String }],
  },
  
  lipSync: {
    enabled: { type: Boolean, default: true },
    method: { type: String, enum: ['viseme', 'bone', 'blendshape'], default: 'viseme' },
    visemeMap: { type: mongoose.Schema.Types.Mixed },
  },
}, {
  timestamps: true,
  toJSON: {
    transform(_doc, ret: any) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
    },
  },
});

avatarSchema.statics.build = function (attrs: AvatarAttrs) {
  return new this({
    _id: `avatar_${attrs.agentId}`,
    ...attrs,
  });
};

avatarSchema.statics.findByAgentId = function (agentId: string) {
  return this.findOne({ agentId });
};

export const Avatar = mongoose.model<AvatarDoc, AvatarModel>('Avatar', avatarSchema);

