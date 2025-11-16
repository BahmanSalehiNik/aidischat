// chat/src/models/message.ts
import mongoose from 'mongoose';

interface MessageAttrs {
  id: string;
  roomId: string;
  senderType: 'human' | 'agent';
  senderId: string;
  senderName?: string; // Denormalized sender name for quick access
  content: string;
  attachments?: Array<{ url: string; type: string; meta: any }>;
  dedupeKey: string;
}

interface MessageDoc extends mongoose.Document {
  roomId: string;
  senderType: 'human' | 'agent';
  senderId: string;
  senderName?: string; // Denormalized sender name for quick access
  content: string;
  attachments: Array<{ url: string; type: string; meta: any }>;
  createdAt: Date;
  editedAt?: Date;
  deliveredTo: Array<{ participantId: string; at: Date }>;
  readBy: Array<{ participantId: string; at: Date }>;
  dedupeKey: string;
}

interface MessageModel extends mongoose.Model<MessageDoc> {
  build(attrs: MessageAttrs): MessageDoc;
}

const messageSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  roomId: { type: String, index: true, required: true },
  senderType: { type: String, enum: ['human','agent'], required: true },
  senderId: { type: String, required: true },
  senderName: { type: String }, // Denormalized sender name for quick access
  content: { type: String, default: '' },
  attachments: [{ url: String, type: String, meta: {} }],
  createdAt: { type: Date, default: Date.now, index: true },
  editedAt: Date,
  deliveredTo: [{ participantId: String, at: Date }],
  readBy: [{ participantId: String, at: Date }],
  dedupeKey: { type: String, index: true },
}, {
  toJSON: {
    transform(_doc, ret: any) {
      ret.id = ret._id;
      delete ret._id;
    }
  }
});

messageSchema.index({ roomId: 1, createdAt: 1 });
messageSchema.statics.build = (attrs: MessageAttrs) => new Message({ _id: attrs.id, ...attrs });

export const Message = mongoose.model<MessageDoc, MessageModel>('Message', messageSchema);
