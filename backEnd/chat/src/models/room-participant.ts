// src/models/room-participant.ts
import mongoose from 'mongoose';

interface RoomParticipantAttrs {
  roomId: string;
  participantId: string;
  participantType: 'human' | 'agent';
  role?: 'member' | 'moderator' | 'owner';
}

interface RoomParticipantDoc extends mongoose.Document {
  roomId: string;
  participantId: string;
  participantType: 'human' | 'agent';
  role: string;
  joinedAt: Date;
  leftAt?: Date;
}

interface RoomParticipantModel extends mongoose.Model<RoomParticipantDoc> {
  build(attrs: RoomParticipantAttrs): RoomParticipantDoc;
}

const roomParticipantSchema = new mongoose.Schema({
  roomId: { type: String, index: true, required: true },
  participantId: { type: String, required: true },
  participantType: { type: String, enum: ['human', 'agent'], required: true },
  role: { type: String, enum: ['member', 'moderator', 'owner'], default: 'member' },
  joinedAt: { type: Date, default: Date.now },
  leftAt: { type: Date },
}, {
  toJSON: {
    transform(_doc, ret: any) {
      ret.id = ret._id;
      delete ret._id;
    }
  }
});

roomParticipantSchema.index({ roomId: 1, participantId: 1 }, { unique: true });
roomParticipantSchema.statics.build = (attrs: RoomParticipantAttrs) => new RoomParticipant(attrs);

export const RoomParticipant = mongoose.model<RoomParticipantDoc, RoomParticipantModel>('RoomParticipant', roomParticipantSchema);
