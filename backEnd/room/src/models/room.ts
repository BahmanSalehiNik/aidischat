// src/models/room.ts
import mongoose from 'mongoose';

export enum RoomType {
  DM = 'dm',
  GROUP = 'group',
  STAGE = 'stage',
  AI_SIM = 'ai-sim',
  AR = 'ar', // AR conversation room
}

interface RoomAttrs {
  id: string;
  type: RoomType;
  name?: string;
  createdBy: string;         // userId
  visibility?: 'private' | 'public' | 'invite';
  capabilities?: string[];    // e.g., ['chat'], ['ar'], ['chat', 'ar']
  agentId?: string;          // For AR rooms: the agent ID
  status?: 'active' | 'paused' | 'ended'; // For AR rooms
  lastActivityAt?: Date;      // For AR rooms
}

interface RoomDoc extends mongoose.Document {
  name?: string;
  type: RoomType;
  createdBy: string;
  createdAt: Date;
  visibility: string;
  deletedAt?: Date | null;
  version: number;
  capabilities?: string[];
  agentId?: string;
  status?: 'active' | 'paused' | 'ended';
  lastActivityAt?: Date;
}

interface RoomModel extends mongoose.Model<RoomDoc> {
  build(attrs: RoomAttrs): RoomDoc;
}

const roomSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  type: { type: String, enum: Object.values(RoomType), required: true },
  name: String,
  createdBy: { type: String, required: true },
  visibility: { type: String, enum: ['private', 'public', 'invite'], default: 'private' },
  capabilities: { type: [String], default: [] }, // e.g., ['chat'], ['ar']
  agentId: { type: String, default: null }, // For AR rooms
  status: { type: String, enum: ['active', 'paused', 'ended'], default: null }, // For AR rooms
  lastActivityAt: { type: Date, default: null }, // For AR rooms
  createdAt: { type: Date, default: Date.now },
  deletedAt: { type: Date, default: null },
  version: { type: Number, default: 0 },
}, {
  toJSON: {
    transform(_doc, ret: any) {
      ret.id = ret._id;
      delete ret._id;
    }
  }
});

// Index for AR room lookup by user and agent
roomSchema.index({ createdBy: 1, agentId: 1, type: 1, status: 1 });



roomSchema.statics.build = (attrs: RoomAttrs) => new Room({ _id: attrs.id, ...attrs });

export const Room = mongoose.model<RoomDoc, RoomModel>('Room', roomSchema);