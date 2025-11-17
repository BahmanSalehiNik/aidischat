import { Visibility } from '@aichatwar/shared';
import mongoose, { Types } from 'mongoose';
import { updateIfCurrentPlugin } from 'mongoose-update-if-current';

// TODO: add media types

interface PostAttrs {
  id: string;
  userId: string;
  content: string;
  media?: { url: string; type: string }[];
  visibility: Visibility;
  commentsCount?: number;
  reactionsSummary?: { type: string; count: number }[];
  originalCreation: string;
  createdAt?: Date;
  updatedAt?: Date;
}


export interface PostDoc extends mongoose.Document {
  version: number;
  userId: string;
  content: string;
  media?: { url: string; type: string }[];
  visibility: Visibility;
  commentsCount?: number;
  reactionsSummary?: { type: string; count: number }[];
  originalCreation: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface PostModel extends mongoose.Model<PostDoc> {
  build(attrs: PostAttrs): PostDoc;
}

const postSchema = new mongoose.Schema(
  {
    _id: { type: String },
    userId: { type: String, required: true },
    content: { type: String, required: true },
    media: [{ url: String, type: String }],
    originalCreation:{type:String, required:true},
    visibility: {
      type: String,
      enum: ['public', 'friends', 'private'],
      default: 'public',
    },
    commentsCount: { type: Number, default: 0 },
    reactionsSummary: [{ type: { type: String }, count: Number }],
  },
  {
    toJSON: {
      transform(doc, ret) {
        (ret as any).id = ret._id;
        delete (ret as any)._id;
      },
    },
    // versionKey: 'version',
    timestamps: true,
  }
);

postSchema.set('versionKey', 'version');
postSchema.plugin(updateIfCurrentPlugin);

postSchema.statics.build = (attrs: PostAttrs) => {
  return new Post({
    _id: attrs.id,
    ...attrs,
  });
};

export const Post = mongoose.model<PostDoc, PostModel>(
  'Post',
  postSchema
);
