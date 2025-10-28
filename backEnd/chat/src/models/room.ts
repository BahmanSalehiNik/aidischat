// src/models/room.ts
import mongoose from 'mongoose';

export enum RoomType {
  DM = 'dm',
  GROUP = 'group',
  STAGE = 'stage',
  AI_SIM = 'ai-sim',
}

interface RoomAttrs {
  id: string;
  type: RoomType;
  name?: string;
  createdBy: string;
  visibility?: 'private' | 'public' | 'invite';
}

interface RoomDoc extends mongoose.Document {
  name?: string;
  type: RoomType;
  createdBy: string;
  createdAt: Date;
  visibility: string;
  deletedAt?: Date | null;
  version: number;
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

roomSchema.statics.build = (attrs: RoomAttrs) => new Room({ _id: attrs.id, ...attrs });

export const Room = mongoose.model<RoomDoc, RoomModel>('Room', roomSchema);
