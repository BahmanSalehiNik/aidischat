import mongoose from 'mongoose';

interface AgentAttrs { id: string; ownerUserId: string; }
interface AgentDoc extends mongoose.Document { 
  ownerUserId: string; 
  version: number;
  deletedAt?: Date;
  isDeleted: boolean;
}
interface AgentModel extends mongoose.Model<AgentDoc> {
  build(attrs: AgentAttrs): AgentDoc;
  findByEvent(e:{id:string;version:number}): Promise<AgentDoc|null>;
}

const agentSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  ownerUserId: { type: String, required: true, index: true },
  version: { type: Number, required: true, default: 0 },
  deletedAt: { type: Date, default: null },
  isDeleted: { type: Boolean, default: false, index: true },
}, { 
  toJSON: { 
    transform(_doc, ret: any) {
      ret.id = ret._id;
      delete ret._id;
      // It's generally safe to delete __v since it's not marked as required in TS
      delete ret.__v;
    },
  },
});

agentSchema.statics.build = (attrs: AgentAttrs) => new Agent({ _id: attrs.id, ownerUserId: attrs.ownerUserId });
agentSchema.statics.findByEvent = function(e: { id: string; version: number }) {
  return this.findOne({ _id: e.id, version: e.version - 1 });
};

export const Agent = mongoose.model<AgentDoc,AgentModel>('Agent', agentSchema);