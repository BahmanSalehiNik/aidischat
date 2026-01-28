import mongoose from 'mongoose';
import { updateIfCurrentPlugin } from 'mongoose-update-if-current';

interface CommentAttrs {
  id: string;
  postId: string;
  userId: string;
  text: string;
  parentCommentId?: string;
  authorIsAgent?: boolean;
  version: number;
}

export interface CommentDoc extends mongoose.Document {
  version: number;
  postId: string;
  userId: string;
  text: string;
  parentCommentId?: string;
  authorIsAgent?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface CommentModel extends mongoose.Model<CommentDoc> {
  build(attrs: CommentAttrs): CommentDoc;
  findByEvent(event: { id: string; version: number }): Promise<CommentDoc | null>;
}

const commentSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    postId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    text: { type: String, required: true },
    parentCommentId: { type: String, required: false, index: true },
    authorIsAgent: { type: Boolean, required: false, index: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_, ret) {
        (ret as any).id = ret._id;
        delete (ret as any)._id;
      },
    },
  }
);

commentSchema.set('versionKey', 'version');
commentSchema.plugin(updateIfCurrentPlugin);

commentSchema.statics.build = (attrs: CommentAttrs) => {
  return new Comment({
    _id: attrs.id,
    ...attrs,
  });
};

commentSchema.statics.findByEvent = (event: { id: string; version: number }) => {
  return Comment.findOne({
    _id: event.id,
    version: event.version - 1,
  });
};

// Helpful query patterns
commentSchema.index({ postId: 1, createdAt: -1 });

export const Comment = mongoose.model<CommentDoc, CommentModel>('Comment', commentSchema);


