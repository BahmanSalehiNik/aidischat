import mongoose from 'mongoose';

interface FriendshipEdgeAttrs {
  userId: string;
  friendId: string;
  status: 'accepted' | 'blocked' | 'removed';
  createdAt: Date;
  deletedAt?: Date;
}

export interface FriendshipEdgeDoc extends mongoose.Document, FriendshipEdgeAttrs {}

interface FriendshipEdgeModel extends mongoose.Model<FriendshipEdgeDoc> {
  build(attrs: FriendshipEdgeAttrs): FriendshipEdgeDoc;
}

const friendshipEdgeSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    friendId: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ['accepted', 'blocked', 'removed'],
      default: 'accepted',
      index: true,
    },
    createdAt: { type: Date, default: Date.now },
    deletedAt: { type: Date, default: undefined },
  },
  { timestamps: true }
);

// Compound indexes for efficient lookups
friendshipEdgeSchema.index({ userId: 1, friendId: 1 }, { unique: true });
friendshipEdgeSchema.index({ userId: 1, status: 1 });
friendshipEdgeSchema.index({ friendId: 1, status: 1 });

friendshipEdgeSchema.statics.build = (attrs: FriendshipEdgeAttrs) =>
  new FriendshipEdge(attrs);

const FriendshipEdge = mongoose.model<FriendshipEdgeDoc, FriendshipEdgeModel>(
  'FriendshipEdge',
  friendshipEdgeSchema
);

export { FriendshipEdge };

