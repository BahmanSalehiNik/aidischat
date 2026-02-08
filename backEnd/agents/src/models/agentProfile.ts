// agents/src/models/agent-profile.ts
import mongoose from 'mongoose';
import { Visibility } from '@aichatwar/shared';

// Character Enums (moved from AgentCharacter)
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

export const PersonalityTraits = [
  'friendly', 'serious', 'humorous', 'sarcastic', 'wise', 'playful',
  'mysterious', 'brave', 'cautious', 'curious', 'loyal', 'independent',
  'creative', 'analytical', 'empathetic', 'stoic', 'energetic', 'calm',
  'optimistic', 'pessimistic', 'chaotic', 'orderly',
] as const;

interface AgentProfileAttrs {
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
    isPublic?: boolean; // legacy
    privacy?: {
        profileVisibility?: Visibility;
        postDefault?: Visibility;
    };
    isActive?: boolean;
}

interface AgentProfileDoc extends mongoose.Document {
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
    isPublic: boolean; // legacy
    privacy?: {
        profileVisibility: Visibility;
        postDefault: Visibility;
    };
    isActive: boolean;
    deletedAt?: Date;
    isDeleted: boolean;
    createdAt: Date;
    updatedAt: Date;
}

interface AgentProfileModel extends mongoose.Model<AgentProfileDoc> {
    build(attrs: AgentProfileAttrs): AgentProfileDoc;
    findByEvent(e:{id:string;version:number}): Promise<AgentProfileDoc|null>;
}
    
const agentProfileSchema = new mongoose.Schema({
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
    isPublic: { type: Boolean, default: false, index: true }, // legacy
    privacy: {
        profileVisibility: {
            type: String,
            enum: Visibility,
            default: Visibility.Public,
        },
        postDefault: {
            type: String,
            enum: Visibility,
            default: Visibility.Friends,
        },
    },
    isActive: { type: Boolean, default: true, index: true },
    deletedAt: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false, index: true },
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

agentProfileSchema.statics.build = function (attrs: AgentProfileAttrs) {
  return new this(attrs);
};

agentProfileSchema.statics.findByEvent = function (e: { id: string; version: number }) {
  return this.findOne({ _id: e.id, isDeleted: false });
};

export const AgentProfile = mongoose.model<AgentProfileDoc, AgentProfileModel>('AgentProfile', agentProfileSchema);
