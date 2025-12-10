import mongoose from 'mongoose';

interface SentimentData {
  overall: 'positive' | 'neutral' | 'negative';
  score: number; // -1 to 1
}

interface ContextData {
  intent: string; // e.g., "question", "discussion", "support"
  domain: string; // e.g., "technical", "social", "business"
  keywords: string[];
}

interface RoomAnalysisResultAttrs {
  roomId: string;
  analyzedAt: Date;
  messageWindowSize: number;
  topics: string[];
  sentiment: SentimentData;
  context: ContextData;
  matchedAgentIds: string[];
  invitedAgentIds: string[];
  invitationReason: string;
  confidence?: number;
}

interface RoomAnalysisResultDoc extends mongoose.Document {
  roomId: string;
  analyzedAt: Date;
  messageWindowSize: number;
  topics: string[];
  sentiment: SentimentData;
  context: ContextData;
  matchedAgentIds: string[];
  invitedAgentIds: string[];
  invitationReason: string;
  confidence: number;
  createdAt: Date;
}

interface RoomAnalysisResultModel extends mongoose.Model<RoomAnalysisResultDoc> {
  build(attrs: RoomAnalysisResultAttrs): RoomAnalysisResultDoc;
}

const roomAnalysisResultSchema = new mongoose.Schema({
  roomId: { type: String, required: true, index: true },
  analyzedAt: { type: Date, required: true, index: true },
  messageWindowSize: { type: Number, required: true },
  topics: [{ type: String }],
  sentiment: {
    overall: { type: String, enum: ['positive', 'neutral', 'negative'], required: true },
    score: { type: Number, required: true, min: -1, max: 1 },
  },
  context: {
    intent: { type: String, required: true },
    domain: { type: String, required: true },
    keywords: [{ type: String }],
  },
  matchedAgentIds: [{ type: String }],
  invitedAgentIds: [{ type: String }],
  invitationReason: { type: String, required: true },
  confidence: { type: Number, default: 0.5, min: 0, max: 1 },
}, {
  timestamps: true,
  toJSON: {
    transform(_doc, ret: any) {
      ret.id = ret._id;
      delete ret._id;
    }
  }
});

roomAnalysisResultSchema.index({ roomId: 1, analyzedAt: -1 });
roomAnalysisResultSchema.index({ analyzedAt: -1 });

roomAnalysisResultSchema.statics.build = (attrs: RoomAnalysisResultAttrs) => {
  return new RoomAnalysisResult(attrs);
};

export const RoomAnalysisResult = mongoose.model<RoomAnalysisResultDoc, RoomAnalysisResultModel>(
  'RoomAnalysisResult',
  roomAnalysisResultSchema
);

