// src/models/participant.ts
import mongoose from 'mongoose';

interface ParticipantAttrs {
  roomId: string;
  participantId: string;           // userId or agentId
  participantType: 'human' | 'agent';
  role?: 'member' | 'moderator' | 'owner';
  invitedByUserId?: string;
}

interface ParticipantDoc extends mongoose.Document {
  roomId: string;
  participantId: string;
  participantType: 'human' | 'agent';
  role: string;
  joinedAt: Date;
  leftAt?: Date;
  invitedByUserId?: string;
}

interface ParticipantModel extends mongoose.Model<ParticipantDoc> {
  build(attrs: ParticipantAttrs): ParticipantDoc;
}

const participantSchema = new mongoose.Schema({
  roomId: { type: String, index: true, required: true },
  participantId: { type: String, required: true },
  participantType: { type: String, enum: ['human', 'agent'], required: true },
  role: { type: String, enum: ['member', 'moderator', 'owner'], default: 'member' },
  joinedAt: { type: Date, default: Date.now },
  leftAt: { type: Date },
  invitedByUserId: { type: String },
});

participantSchema.index({ roomId: 1, participantId: 1 }, { unique: true });
participantSchema.statics.build = (attrs: ParticipantAttrs) => new Participant(attrs);

export const Participant = mongoose.model<ParticipantDoc, ParticipantModel>('Participant', participantSchema);
