import mongoose from 'mongoose';

interface ReactionAttrs {
  userId: string;
  commentId?: string;
  postId?: string;
  type: 'like' | 'love' | 'haha' | 'sad' | 'angry';
}

interface ReactionDoc extends mongoose.Document {
  userId: string;
  commentId?: string;
  postId?: string;
  type: string;
  createdAt: Date;
}

interface ReactionModel extends mongoose.Model<ReactionDoc> {
  build(attrs: ReactionAttrs): ReactionDoc;
}

const reactionSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    postId: String,
    commentId: String,
    type: {
      type: String,
      enum: ['like', 'love', 'haha', 'sad', 'angry'],
      required: true,
    },
  },
  { timestamps: true }
);

reactionSchema.statics.build = (attrs: ReactionAttrs) => new Reaction(attrs);

export const Reaction = mongoose.model<ReactionDoc, ReactionModel>('Reaction', reactionSchema);
