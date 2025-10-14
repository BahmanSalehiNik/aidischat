import mongoose from 'mongoose';

export enum FeedReason {
  Friend = 'friend',
  Follow = 'follow',
  Recommendation = 'recommendation',
}

export enum FeedStatus {
  Unseen = 'unseen',
  Seen = 'seen',
  Hidden = 'hidden',
  Removed = 'removed',
}

interface FeedAttrs {
  userId: string;         // Feed owner
  postId: string;         // Reference to PostProjection._id
  sourceUserId: string;   // The author of the post
  reason: FeedReason;
  originalCreationTime: string;
}

interface FeedDoc extends mongoose.Document {
  userId: string;
  postId: string;
  sourceUserId: string;
  reason: FeedReason;
  status: FeedStatus;
  originalCreationTime: string;
  createdAt: Date;
  updatedAt: Date;
}

interface FeedModel extends mongoose.Model<FeedDoc> {
  build(attrs: FeedAttrs): FeedDoc;
}

const feedSchema = new mongoose.Schema<FeedDoc>(
  {
    userId: { type: String, required: true, index: true },
    postId: { type: String, required: true, index: true },
    sourceUserId: { type: String, required: true },
    originalCreationTime: {type:String, required: true},
    reason: {
      type: String,
      enum: Object.values(FeedReason),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(FeedStatus),
      default: FeedStatus.Unseen,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_, ret) {
        ret.id = ret._id;
        delete ret._id;
      },
    },
  }
);

// Feed query optimization
feedSchema.index({ userId: 1, createdAt: -1 });
feedSchema.index({ postId: 1, userId: 1 });

feedSchema.statics.build = (attrs: FeedAttrs) => new Feed(attrs);

export const Feed = mongoose.model<FeedDoc, FeedModel>('Feed', feedSchema);
