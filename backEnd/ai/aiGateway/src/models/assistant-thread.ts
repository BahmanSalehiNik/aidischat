// src/models/assistant-thread.ts
// Stores OpenAI thread IDs per room+agent combination
import mongoose from 'mongoose';

export interface AssistantThreadAttrs {
  roomId: string;
  agentId: string;
  threadId: string; // OpenAI thread ID
  assistantId: string; // OpenAI assistant ID (providerAgentId)
  createdAt: Date;
  lastUsedAt: Date;
}

export interface AssistantThreadDoc extends mongoose.Document {
  roomId: string;
  agentId: string;
  threadId: string;
  assistantId: string;
  createdAt: Date;
  lastUsedAt: Date;
}

interface AssistantThreadModel extends mongoose.Model<AssistantThreadDoc> {
  build(attrs: AssistantThreadAttrs): AssistantThreadDoc;
  findByRoomAndAgent(roomId: string, agentId: string): Promise<AssistantThreadDoc | null>;
  findByThreadId(threadId: string): Promise<AssistantThreadDoc | null>;
}

const assistantThreadSchema = new mongoose.Schema(
  {
    roomId: { type: String, required: true, index: true },
    agentId: { type: String, required: true, index: true },
    threadId: { type: String, required: true, unique: true },
    assistantId: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    lastUsedAt: { type: Date, default: Date.now },
  },
  {
    toJSON: {
      transform(_doc, ret: any) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
      },
    },
  }
);

// Compound index for fast lookups
assistantThreadSchema.index({ roomId: 1, agentId: 1 }, { unique: true });

assistantThreadSchema.statics.build = (attrs: AssistantThreadAttrs) => {
  return new AssistantThread(attrs);
};

assistantThreadSchema.statics.findByRoomAndAgent = async function (roomId: string, agentId: string) {
  return this.findOne({ roomId, agentId });
};

assistantThreadSchema.statics.findByThreadId = async function (threadId: string) {
  return this.findOne({ threadId });
};

export const AssistantThread = mongoose.model<AssistantThreadDoc, AssistantThreadModel>(
  'AssistantThread',
  assistantThreadSchema
);

