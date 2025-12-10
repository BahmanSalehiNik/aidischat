import mongoose from 'mongoose';

interface RoomAnalysisStateAttrs {
  roomId: string;
  lastAnalysisAt?: Date | null;
  lastInvitationAt?: Date | null;
  totalAnalyses?: number;
  totalInvitations?: number;
  cooldownUntil?: Date | null;
  activeWindowSize?: number;
}

interface RoomAnalysisStateDoc extends mongoose.Document {
  roomId: string;
  lastAnalysisAt: Date | null;
  lastInvitationAt: Date | null;
  totalAnalyses: number;
  totalInvitations: number;
  cooldownUntil: Date | null;
  activeWindowSize: number;
  createdAt: Date;
  updatedAt: Date;
}

interface RoomAnalysisStateModel extends mongoose.Model<RoomAnalysisStateDoc> {
  build(attrs: RoomAnalysisStateAttrs): RoomAnalysisStateDoc;
}

const roomAnalysisStateSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  roomId: { type: String, required: true, unique: true, index: true },
  lastAnalysisAt: { type: Date, default: null },
  lastInvitationAt: { type: Date, default: null },
  totalAnalyses: { type: Number, default: 0 },
  totalInvitations: { type: Number, default: 0 },
  cooldownUntil: { type: Date, default: null },
  activeWindowSize: { type: Number, default: 0 },
}, {
  timestamps: true,
  toJSON: {
    transform(_doc, ret: any) {
      ret.id = ret._id;
      delete ret._id;
    }
  }
});

roomAnalysisStateSchema.statics.build = (attrs: RoomAnalysisStateAttrs) => {
  return new RoomAnalysisState({ _id: attrs.roomId, ...attrs });
};

export const RoomAnalysisState = mongoose.model<RoomAnalysisStateDoc, RoomAnalysisStateModel>(
  'RoomAnalysisState',
  roomAnalysisStateSchema
);

export type { RoomAnalysisStateDoc };

