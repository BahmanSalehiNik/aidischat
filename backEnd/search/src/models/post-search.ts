import mongoose from 'mongoose';

interface PostSearchAttrs {
  postId: string;
  authorId: string;
  caption: string;
  tags?: string[];
  mediaPreviewUrl?: string;
}

export interface PostSearchDoc extends mongoose.Document, PostSearchAttrs {}

interface PostSearchModel extends mongoose.Model<PostSearchDoc> {
  build(attrs: PostSearchAttrs): PostSearchDoc;
}

const postSearchSchema = new mongoose.Schema(
  {
    postId: { type: String, required: true, unique: true },
    authorId: { type: String, required: true },
    caption: { type: String, required: true },
    tags: [String],
    mediaPreviewUrl: String,
  },
  { timestamps: true }
);

postSearchSchema.index({ caption: 'text', tags: 'text' });

postSearchSchema.statics.build = (attrs: PostSearchAttrs) => new PostSearch(attrs);

const PostSearch = mongoose.model<PostSearchDoc, PostSearchModel>('PostSearch', postSearchSchema);

export { PostSearch };

