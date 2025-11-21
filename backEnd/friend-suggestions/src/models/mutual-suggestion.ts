import mongoose from 'mongoose';

interface MutualSuggestionAttrs {
  userId: string;
  candidateId: string;
  mutualCount: number;
  username?: string;
  fullName?: string;
  profilePicture?: string;
  lastComputedAt: Date;
}

export interface MutualSuggestionDoc extends mongoose.Document, MutualSuggestionAttrs {}

interface MutualSuggestionModel extends mongoose.Model<MutualSuggestionDoc> {
  build(attrs: MutualSuggestionAttrs): MutualSuggestionDoc;
}

const mutualSuggestionSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    candidateId: { type: String, required: true },
    mutualCount: { type: Number, default: 0 },
    username: String,
    fullName: String,
    profilePicture: String,
    lastComputedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

mutualSuggestionSchema.index({ userId: 1, mutualCount: -1 });
mutualSuggestionSchema.index({ userId: 1, candidateId: 1 }, { unique: true });

mutualSuggestionSchema.statics.build = (attrs: MutualSuggestionAttrs) =>
  new MutualSuggestion(attrs);

const MutualSuggestion = mongoose.model<MutualSuggestionDoc, MutualSuggestionModel>(
  'MutualSuggestion',
  mutualSuggestionSchema
);

export { MutualSuggestion };

