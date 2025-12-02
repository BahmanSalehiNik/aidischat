import mongoose from 'mongoose';
import { updateIfCurrentPlugin } from 'mongoose-update-if-current';

// Character Enums (same as agents service)
export const AgeRange = {
  CHILD: 'child',
  TEEN: 'teen',
  YOUNG_ADULT: 'young-adult',
  ADULT: 'adult',
  MIDDLE_AGED: 'middle-aged',
  ELDERLY: 'elderly',
  ANCIENT: 'ancient',
  AGELESS: 'ageless',
} as const;

export const Gender = {
  MALE: 'male',
  FEMALE: 'female',
  NON_BINARY: 'non-binary',
  GENDERFLUID: 'genderfluid',
  AGENDER: 'agender',
  OTHER: 'other',
} as const;

export const BreedType = {
  HUMAN: 'human',
  HUMANOID: 'humanoid',
  GOBLIN: 'goblin',
  ANGEL: 'angel',
  DEMON: 'demon',
  ANIMAL: 'animal',
  ROBOT: 'robot',
  ANDROID: 'android',
  ANIME: 'anime',
  FANTASY_CREATURE: 'fantasy-creature',
  MYTHICAL: 'mythical',
  ALIEN: 'alien',
  HYBRID: 'hybrid',
  OTHER: 'other',
} as const;

export const Build = {
  SLIM: 'slim',
  ATHLETIC: 'athletic',
  AVERAGE: 'average',
  MUSCULAR: 'muscular',
  CURVY: 'curvy',
  HEAVY: 'heavy',
  PETITE: 'petite',
  TALL: 'tall',
  OTHER: 'other',
} as const;

export const Role = {
  ASSISTANT: 'assistant',
  COMPANION: 'companion',
  MENTOR: 'mentor',
  ADVERSARY: 'adversary',
  NEUTRAL: 'neutral',
  GUARDIAN: 'guardian',
  ENTERTAINER: 'entertainer',
  EDUCATOR: 'educator',
  OTHER: 'other',
} as const;

export const CommunicationStyle = {
  FORMAL: 'formal',
  CASUAL: 'casual',
  TECHNICAL: 'technical',
  POETIC: 'poetic',
  SLANG: 'slang',
  ANCIENT: 'ancient',
  MODERN: 'modern',
  MIXED: 'mixed',
} as const;

export const RelationshipToUser = {
  FRIEND: 'friend',
  MENTOR: 'mentor',
  ASSISTANT: 'assistant',
  COMPANION: 'companion',
  RIVAL: 'rival',
  NEUTRAL: 'neutral',
  GUARDIAN: 'guardian',
  STUDENT: 'student',
  OTHER: 'other',
} as const;

export const ColorTheme = {
  LIGHT: 'light',
  DARK: 'dark',
  COLORFUL: 'colorful',
  MONOCHROME: 'monochrome',
  NEON: 'neon',
  PASTEL: 'pastel',
} as const;

interface AgentProfileAttrs {
  id: string;
  name: string;
  // Character fields
  displayName?: string;
  title?: string;
  age?: number;
  ageRange?: string;
  gender?: string;
  nationality?: string;
  ethnicity?: string;
  breed?: string;
  subtype?: string;
  height?: string;
  build?: string;
  hairColor?: string;
  eyeColor?: string;
  skinTone?: string;
  distinguishingFeatures?: string[];
  profession?: string;
  role?: string;
  specialization?: string;
  organization?: string;
  personality?: string[];
  communicationStyle?: string;
  speechPattern?: string;
  backstory?: string;
  origin?: string;
  currentLocation?: string;
  goals?: string[];
  fears?: string[];
  interests?: string[];
  abilities?: string[];
  skills?: string[];
  limitations?: string[];
  relationshipToUser?: string;
  avatarUrl?: string;
  avatarPublicId?: string;
  colorScheme?: {
    primaryColor?: string;
    secondaryColor?: string;
    theme?: string;
  };
  tags?: string[];
  isPublic?: boolean;
  isActive?: boolean;
  deletedAt?: Date;
  isDeleted?: boolean;
}

export interface AgentProfileDoc extends mongoose.Document {
  name: string;
  // Character fields
  displayName?: string;
  title?: string;
  age?: number;
  ageRange?: string;
  gender?: string;
  nationality?: string;
  ethnicity?: string;
  breed?: string;
  subtype?: string;
  height?: string;
  build?: string;
  hairColor?: string;
  eyeColor?: string;
  skinTone?: string;
  distinguishingFeatures?: string[];
  profession?: string;
  role?: string;
  specialization?: string;
  organization?: string;
  personality?: string[];
  communicationStyle?: string;
  speechPattern?: string;
  backstory?: string;
  origin?: string;
  currentLocation?: string;
  goals?: string[];
  fears?: string[];
  interests?: string[];
  abilities?: string[];
  skills?: string[];
  limitations?: string[];
  relationshipToUser?: string;
  avatarUrl?: string;
  avatarPublicId?: string;
  colorScheme?: {
    primaryColor?: string;
    secondaryColor?: string;
    theme?: string;
  };
  tags?: string[];
  isPublic: boolean;
  isActive: boolean;
  deletedAt?: Date;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface AgentProfileModel extends mongoose.Model<AgentProfileDoc> {
  build(attrs: AgentProfileAttrs): AgentProfileDoc;
}

const agentProfileSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  name: { type: String, required: true, trim: true, index: true },
  // Character fields
  displayName: { type: String, trim: true },
  title: { type: String, trim: true },
  age: { type: Number, min: 0 },
  ageRange: {
    type: String,
    enum: Object.values(AgeRange),
  },
  gender: {
    type: String,
    enum: Object.values(Gender),
  },
  nationality: { type: String, trim: true },
  ethnicity: { type: String, trim: true },
  breed: {
    type: String,
    enum: Object.values(BreedType),
  },
  subtype: { type: String, trim: true },
  height: { type: String, trim: true },
  build: {
    type: String,
    enum: Object.values(Build),
  },
  hairColor: { type: String, trim: true },
  eyeColor: { type: String, trim: true },
  skinTone: { type: String, trim: true },
  distinguishingFeatures: [{ type: String, trim: true }],
  profession: { type: String, trim: true },
  role: {
    type: String,
    enum: Object.values(Role),
  },
  specialization: { type: String, trim: true },
  organization: { type: String, trim: true },
  personality: [{ type: String, trim: true }],
  communicationStyle: {
    type: String,
    enum: Object.values(CommunicationStyle),
  },
  speechPattern: { type: String, trim: true, maxlength: 500 },
  backstory: { type: String, trim: true, maxlength: 2000 },
  origin: { type: String, trim: true },
  currentLocation: { type: String, trim: true },
  goals: [{ type: String, trim: true }],
  fears: [{ type: String, trim: true }],
  interests: [{ type: String, trim: true }],
  abilities: [{ type: String, trim: true }],
  skills: [{ type: String, trim: true }],
  limitations: [{ type: String, trim: true }],
  relationshipToUser: {
    type: String,
    enum: Object.values(RelationshipToUser),
  },
  avatarUrl: { type: String, trim: true },
  avatarPublicId: { type: String, trim: true },
  colorScheme: {
    primaryColor: { type: String, trim: true },
    secondaryColor: { type: String, trim: true },
    theme: {
      type: String,
      enum: Object.values(ColorTheme),
    },
  },
  tags: [{ type: String, trim: true, lowercase: true }],
  isPublic: { type: Boolean, default: false, index: true },
  isActive: { type: Boolean, default: true, index: true },
  deletedAt: { type: Date, default: null },
  isDeleted: { type: Boolean, default: false, index: true },
}, {
  timestamps: true,
  toJSON: {
    transform(doc, ret: any) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
    },
  },
});

agentProfileSchema.set('versionKey', 'version');
agentProfileSchema.plugin(updateIfCurrentPlugin);

agentProfileSchema.statics.build = function (attrs: AgentProfileAttrs) {
  return new AgentProfile({
    _id: attrs.id,
    name: attrs.name,
    displayName: attrs.displayName,
    title: attrs.title,
    age: attrs.age,
    ageRange: attrs.ageRange,
    gender: attrs.gender,
    nationality: attrs.nationality,
    ethnicity: attrs.ethnicity,
    breed: attrs.breed,
    subtype: attrs.subtype,
    height: attrs.height,
    build: attrs.build,
    hairColor: attrs.hairColor,
    eyeColor: attrs.eyeColor,
    skinTone: attrs.skinTone,
    distinguishingFeatures: attrs.distinguishingFeatures,
    profession: attrs.profession,
    role: attrs.role,
    specialization: attrs.specialization,
    organization: attrs.organization,
    personality: attrs.personality,
    communicationStyle: attrs.communicationStyle,
    speechPattern: attrs.speechPattern,
    backstory: attrs.backstory,
    origin: attrs.origin,
    currentLocation: attrs.currentLocation,
    goals: attrs.goals,
    fears: attrs.fears,
    interests: attrs.interests,
    abilities: attrs.abilities,
    skills: attrs.skills,
    limitations: attrs.limitations,
    relationshipToUser: attrs.relationshipToUser,
    avatarUrl: attrs.avatarUrl,
    avatarPublicId: attrs.avatarPublicId,
    colorScheme: attrs.colorScheme,
    tags: attrs.tags,
    isPublic: attrs.isPublic ?? false,
    isActive: attrs.isActive ?? true,
    deletedAt: attrs.deletedAt,
    isDeleted: attrs.isDeleted ?? false,
  });
};

export const AgentProfile = mongoose.model<AgentProfileDoc, AgentProfileModel>('AgentProfile', agentProfileSchema);

