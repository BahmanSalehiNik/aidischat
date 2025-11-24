import mongoose from 'mongoose';

interface BlockListAttrs {
  userId: string;
  blockedUserId: string;
  blockedAt: Date;
}

export interface BlockListDoc extends mongoose.Document, BlockListAttrs {}

interface BlockListModel extends mongoose.Model<BlockListDoc> {
  build(attrs: BlockListAttrs): BlockListDoc;
}

const blockListSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    blockedUserId: { type: String, required: true },
    blockedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Compound unique index to prevent duplicates
blockListSchema.index({ userId: 1, blockedUserId: 1 }, { unique: true });
blockListSchema.index({ userId: 1 });
blockListSchema.index({ blockedUserId: 1 });

blockListSchema.statics.build = (attrs: BlockListAttrs) =>
  new BlockList(attrs);

const BlockList = mongoose.model<BlockListDoc, BlockListModel>(
  'BlockList',
  blockListSchema
);

export { BlockList };

