import mongoose from 'mongoose';

interface PostAuthorStatusAttrs {
  postId: string;
  authorId: string;
  isAuthorDeleted: boolean;
  isAuthorBlocked: boolean;
  updatedAt: Date;
}

export interface PostAuthorStatusDoc extends mongoose.Document, PostAuthorStatusAttrs {}

interface PostAuthorStatusModel extends mongoose.Model<PostAuthorStatusDoc> {
  build(attrs: PostAuthorStatusAttrs): PostAuthorStatusDoc;
}

const postAuthorStatusSchema = new mongoose.Schema(
  {
    postId: { type: String, required: true, unique: true, index: true },
    authorId: { type: String, required: true, index: true },
    isAuthorDeleted: { type: Boolean, default: false, index: true },
    isAuthorBlocked: { type: Boolean, default: false, index: true },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

postAuthorStatusSchema.index({ authorId: 1, isAuthorDeleted: 1 });
postAuthorStatusSchema.index({ authorId: 1, isAuthorBlocked: 1 });

postAuthorStatusSchema.statics.build = (attrs: PostAuthorStatusAttrs) =>
  new PostAuthorStatus(attrs);

const PostAuthorStatus = mongoose.model<PostAuthorStatusDoc, PostAuthorStatusModel>(
  'PostAuthorStatus',
  postAuthorStatusSchema
);

export { PostAuthorStatus };

