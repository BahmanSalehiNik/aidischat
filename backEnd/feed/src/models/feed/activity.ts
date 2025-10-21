import mongoose from 'mongoose';

export enum ActivityVerb {
  PostCreated = 'post_created',
  CommentAdded = 'comment_added',
  ReactionAdded = 'reaction_added',
  ReactionRemoved = 'reaction_removed',
  PostDeleted = 'post_deleted',
  Followed = 'followed',
}

interface ActivityAttrs {
  actorId: string;       // Who performed the action
  objectId: string;      // On what (postId/commentId)
  verb: ActivityVerb;
  targetUserId?: string; // Optional: who is affected
  metadata?: Record<string, any>;
}

interface ActivityDoc extends mongoose.Document {
  actorId: string;
  objectId: string;
  verb: ActivityVerb;
  targetUserId?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

interface ActivityModel extends mongoose.Model<ActivityDoc> {
  build(attrs: ActivityAttrs): ActivityDoc;
}

const activitySchema = new mongoose.Schema<ActivityDoc>(
  {
    actorId: { type: String, required: true, index: true },
    objectId: { type: String, required: true },
    verb: { type: String, enum: Object.values(ActivityVerb), required: true },
    targetUserId: { type: String },
    metadata: { type: Object },
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

activitySchema.index({ actorId: 1, createdAt: -1 });
activitySchema.index({ verb: 1, createdAt: -1 });

activitySchema.statics.build = (attrs: ActivityAttrs) => new Activity(attrs);

export const Activity = mongoose.model<ActivityDoc, ActivityModel>('Activity', activitySchema);
