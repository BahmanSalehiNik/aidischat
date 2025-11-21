import mongoose from 'mongoose';

export interface TrendingPostAttrs {
  postId: string;
  authorId: string;
  content: string;
  media?: { id: string; url: string; type: string }[];
  trendingScore: number;
  createdAt: Date;
}

export interface TrendingPostDoc extends mongoose.Document, TrendingPostAttrs {}

interface TrendingPostModel extends mongoose.Model<TrendingPostDoc> {
  build(attrs: TrendingPostAttrs): TrendingPostDoc;
}

const trendingPostSchema = new mongoose.Schema(
  {
    postId: { type: String, required: true, unique: true },
    authorId: { type: String, required: true },
    content: { type: String, required: true },
    media: [
      {
        id: { type: String },
        url: { type: String },
        type: { type: String },
      },
    ],
    trendingScore: { type: Number, required: true },
    createdAt: { type: Date, required: true },
  },
  { timestamps: true }
);

trendingPostSchema.index({ trendingScore: -1, createdAt: -1 });

trendingPostSchema.statics.build = (attrs: TrendingPostAttrs) => new TrendingPost(attrs);

export const TrendingPost = mongoose.model<TrendingPostDoc, TrendingPostModel>(
  'TrendingPost',
  trendingPostSchema
);

