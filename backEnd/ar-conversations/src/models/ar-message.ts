// src/models/ar-message.ts
import mongoose from 'mongoose';

interface ARMessageAttrs {
  id: string;
  roomId: string; // References Room.id from Room Service
  senderId: string;
  senderType: 'human' | 'agent';
  content: string; // Text with markers like [emotion:happy]Hello!
  markers?: Array<{ type: string; value: string }>; // Extracted markers
  status: 'streaming' | 'completed' | 'failed';
}

interface ARMessageDoc extends mongoose.Document {
  roomId: string;
  senderId: string;
  senderType: 'human' | 'agent';
  content: string;
  markers: Array<{ type: string; value: string }>;
  status: 'streaming' | 'completed' | 'failed';
  createdAt: Date;
}

interface ARMessageModel extends mongoose.Model<ARMessageDoc> {
  build(attrs: ARMessageAttrs): ARMessageDoc;
}

const arMessageSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  roomId: { type: String, index: true, required: true },
  senderId: { type: String, index: true, required: true },
  senderType: { type: String, enum: ['human', 'agent'], required: true },
  content: { type: String, required: true },
  markers: [{
    type: { type: String, required: true },
    value: { type: String, required: true }
  }],
  status: { 
    type: String, 
    enum: ['streaming', 'completed', 'failed'], 
    default: 'streaming',
    index: true
  },
  createdAt: { type: Date, default: Date.now, index: true },
}, {
  toJSON: {
    transform(_doc, ret: any) {
      ret.id = ret._id;
      delete ret._id;
    }
  }
});

arMessageSchema.statics.build = (attrs: ARMessageAttrs) => {
  return new ARMessage({
    _id: attrs.id,
    roomId: attrs.roomId,
    senderId: attrs.senderId,
    senderType: attrs.senderType,
    content: attrs.content,
    markers: attrs.markers || [],
    status: attrs.status || 'streaming',
  });
};

export const ARMessage = mongoose.model<ARMessageDoc, ARMessageModel>('ARMessage', arMessageSchema);

