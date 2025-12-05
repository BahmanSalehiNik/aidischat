// src/models/session.ts
import mongoose from 'mongoose';

interface SessionAttrs {
  id: string;
  roomId: string;
  participantId: string;
  participantType: 'human' | 'agent';
  startTime: Date;
  endTime?: Date;
  lastActivityTime: Date;
  firstMessageId: string; // First message in this session
  lastMessageId: string; // Last message in this session (updated as new messages arrive)
  messageCount: number;
  title?: string; // Optional session title/name
}

interface SessionDoc extends mongoose.Document {
  roomId: string;
  participantId: string;
  participantType: 'human' | 'agent';
  startTime: Date;
  endTime?: Date;
  lastActivityTime: Date;
  firstMessageId: string; // First message in this session
  lastMessageId: string; // Last message in this session
  messageCount: number;
  title?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface SessionModel extends mongoose.Model<SessionDoc> {
  build(attrs: SessionAttrs): SessionDoc;
}

const sessionSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  roomId: { type: String, required: true },
  participantId: { type: String, required: true },
  participantType: { type: String, enum: ['human', 'agent'], required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date },
  lastActivityTime: { type: Date, required: true },
  firstMessageId: { type: String, required: true },
  lastMessageId: { type: String, required: true },
  messageCount: { type: Number, default: 0 },
  title: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, {
  toJSON: {
    transform(_doc, ret: any) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
    }
  }
});

// Optimized indexes for read-heavy CQRS pattern
// Index 1: Primary query - Get sessions by participant, sorted by startTime (most common)
// Covers: getSessionsByParticipant() with optional roomId filter
sessionSchema.index({ participantId: 1, participantType: 1, startTime: -1 });

// Index 2: Get sessions by participant with room filter, sorted by startTime
// Covers: getSessionsByParticipant() with roomId filter
sessionSchema.index({ participantId: 1, participantType: 1, roomId: 1, startTime: -1 });

// Index 3: Get active sessions for a participant in a room (for session continuation)
// Covers: getOrCreateActiveSession() - finding active sessions
sessionSchema.index({ roomId: 1, participantId: 1, participantType: 1, endTime: 1, lastActivityTime: 1 });

// Index 4: Get sessions by participant filtering ended sessions, sorted by startTime
// Covers: getSessionsByParticipant() with includeActive=false
sessionSchema.index({ participantId: 1, participantType: 1, endTime: 1, startTime: -1 });

// Index 5: Find session by first message (for message-to-session lookup)
sessionSchema.index({ firstMessageId: 1 });

// Index 6: Find session by last message (for message-to-session lookup)
sessionSchema.index({ lastMessageId: 1 });

// Index 7: Get all sessions in a room (for room-based queries)
sessionSchema.index({ roomId: 1, startTime: -1 });

sessionSchema.statics.build = (attrs: SessionAttrs) => new Session({ _id: attrs.id, ...attrs });

export const Session = mongoose.model<SessionDoc, SessionModel>('Session', sessionSchema);
export type { SessionDoc };

