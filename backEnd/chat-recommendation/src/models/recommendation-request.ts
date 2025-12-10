import mongoose from 'mongoose';
import { Recommendation } from '@aichatwar/shared';

interface RecommendationRequestAttrs {
  requestId: string;
  contextType: 'chat' | 'feed' | 'explore' | 'profile';
  userId: string;
  roomId?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  requestedAt: Date;
  completedAt?: Date;
  recommendations?: Recommendation[];
  error?: string;
}

interface RecommendationRequestDoc extends mongoose.Document {
  requestId: string;
  contextType: 'chat' | 'feed' | 'explore' | 'profile';
  userId: string;
  roomId?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  requestedAt: Date;
  completedAt?: Date;
  recommendations?: Recommendation[];
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface RecommendationRequestModel extends mongoose.Model<RecommendationRequestDoc> {
  build(attrs: RecommendationRequestAttrs): RecommendationRequestDoc;
}

const recommendationRequestSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  requestId: { type: String, required: true, unique: true, index: true },
  contextType: { type: String, enum: ['chat', 'feed', 'explore', 'profile'], required: true, index: true },
  userId: { type: String, required: true, index: true },
  roomId: { type: String, index: true },
  status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending', index: true },
  requestedAt: { type: Date, required: true, index: true },
  completedAt: { type: Date },
  recommendations: [{ type: mongoose.Schema.Types.Mixed }],
  error: { type: String },
}, {
  timestamps: true,
  toJSON: {
    transform(_doc, ret: any) {
      ret.id = ret._id;
      delete ret._id;
    }
  }
});

recommendationRequestSchema.index({ userId: 1, requestedAt: -1 });
recommendationRequestSchema.index({ roomId: 1, requestedAt: -1 });

recommendationRequestSchema.statics.build = (attrs: RecommendationRequestAttrs) => {
  return new RecommendationRequest({ _id: attrs.requestId, ...attrs });
};

export const RecommendationRequest = mongoose.model<RecommendationRequestDoc, RecommendationRequestModel>(
  'RecommendationRequest',
  recommendationRequestSchema
);

