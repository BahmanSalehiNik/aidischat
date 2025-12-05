// src/models/message-session-link.ts
import mongoose from 'mongoose';

interface MessageSessionLinkAttrs {
  messageId: string;
  sessionId: string;
  roomId: string;
  participantId: string;
  participantType: 'human' | 'agent';
  createdAt: Date;
}

interface MessageSessionLinkDoc extends mongoose.Document {
  messageId: string;
  sessionId: string;
  roomId: string;
  participantId: string;
  participantType: 'human' | 'agent';
  createdAt: Date;
}

interface MessageSessionLinkModel extends mongoose.Model<MessageSessionLinkDoc> {
  build(attrs: MessageSessionLinkAttrs): MessageSessionLinkDoc;
}

const messageSessionLinkSchema = new mongoose.Schema({
  messageId: { type: String, required: true },
  sessionId: { type: String, required: true },
  roomId: { type: String, required: true },
  participantId: { type: String, required: true },
  participantType: { type: String, enum: ['human', 'agent'], required: true },
  createdAt: { type: Date, default: Date.now },
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
// Index 1: Primary query - Get messages by session in chronological order (most common)
// Covers: getMessagesBySession() with sorting
messageSessionLinkSchema.index({ sessionId: 1, createdAt: 1 });

// Index 2: Unique constraint - One session per message (for idempotency)
messageSessionLinkSchema.index({ messageId: 1 }, { unique: true });

// Index 3: Get all messages for a participant in a room (for participant-based queries)
// Covers: Querying all messages from a participant in a specific room
messageSessionLinkSchema.index({ roomId: 1, participantId: 1, participantType: 1, createdAt: 1 });

// Index 4: Get messages by session with pagination (alternative ordering)
// Useful for reverse chronological queries
messageSessionLinkSchema.index({ sessionId: 1, createdAt: -1 });

messageSessionLinkSchema.statics.build = (attrs: MessageSessionLinkAttrs) => 
  new MessageSessionLink(attrs);

export const MessageSessionLink = mongoose.model<MessageSessionLinkDoc, MessageSessionLinkModel>(
  'MessageSessionLink',
  messageSessionLinkSchema
);

