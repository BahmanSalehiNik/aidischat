import mongoose from 'mongoose';

interface UserFeatureAttrs {
  userId: string;
  interests: string[];
  preferredAgents: string[];
  interactionHistory: Array<{
    agentId: string;
    interactionCount: number;
    lastInteractionAt: Date;
    sentiment: 'positive' | 'neutral' | 'negative';
  }>;
  embeddings?: number[];
  preferences: {
    domains: string[];
    topics: string[];
  };
  language?: string; // Preferred language
  lastUpdatedAt: Date;
}

interface UserFeatureDoc extends mongoose.Document {
  userId: string;
  interests: string[];
  preferredAgents: string[];
  interactionHistory: Array<{
    agentId: string;
    interactionCount: number;
    lastInteractionAt: Date;
    sentiment: 'positive' | 'neutral' | 'negative';
  }>;
  embeddings?: number[];
  preferences: {
    domains: string[];
    topics: string[];
  };
  language?: string;
  lastUpdatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface UserFeatureModel extends mongoose.Model<UserFeatureDoc> {
  build(attrs: UserFeatureAttrs): UserFeatureDoc;
}

const userFeatureSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  userId: { type: String, required: true, unique: true, index: true },
  interests: [{ type: String, index: true }],
  preferredAgents: [{ type: String }],
  interactionHistory: [{
    agentId: { type: String, required: true },
    interactionCount: { type: Number, default: 0 },
    lastInteractionAt: { type: Date, default: Date.now },
    sentiment: { type: String, enum: ['positive', 'neutral', 'negative'] },
  }],
  embeddings: [{ type: Number }],
  preferences: {
    domains: [{ type: String }],
    topics: [{ type: String }],
  },
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

userFeatureSchema.statics.build = (attrs: UserFeatureAttrs) => {
  return new UserFeature({ _id: attrs.userId, ...attrs });
};

export const UserFeature = mongoose.model<UserFeatureDoc, UserFeatureModel>(
  'UserFeature',
  userFeatureSchema
);

