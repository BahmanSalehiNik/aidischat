// models/post.ts
import mongoose, { Types } from 'mongoose';
import {Visibility, PostStatus } from '@aichatwar/shared'



interface DummyRet {
    _id: Types.ObjectId | undefined;
    id?: Types.ObjectId | undefined;
}


interface PostAttrs {
  id: string;
  userId: string;
  content: string;
  mediaIds?: string[];
  visibility:Visibility;
  version: number;
  status?: PostStatus
}

interface PostDoc extends mongoose.Document {
  id: string;
  userId: string;
  content: string;
  mediaIds?: string[];
  visibility: string;
  createdAt: Date;
  updatedAt: Date;
  reactions: { userId: string; type: string }[];
  version: number;
  status: PostStatus;
  deletedAt?: Date;
  isDeleted: boolean;
}

interface PostModel extends mongoose.Model<PostDoc>{
  build(attr: PostAttrs): PostDoc;
}




const postSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    content: { type: String, required: true },
    // TODO: Change this to { url: string; type: string }[]
    mediaIds: [String],
    visibility: { type: String, Visibility, default: 'public' },
    reactions: [{ userId: String, type: String }],
    status: {
      type: String,
      enum: PostStatus,
      default: PostStatus.Active
    },
    deletedAt: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false, index: true }
  },
  { timestamps: true, 
    toJSON:{
            transform(doc, ret: DummyRet) {
        ret.id = ret._id;
        delete ret._id;
      },

    }
  }

);

// Index for efficient sorting by createdAt
postSchema.index({ createdAt: -1 });
postSchema.index({ userId: 1, createdAt: -1 }); // Compound index for user posts queries

postSchema.statics.build = async(attrs: PostAttrs)=>{
  const {id, ...rest} = attrs;
  return new Post({
    _id: id,
    ...rest
  })

}

const Post = mongoose.model<PostDoc, PostModel>('Post', postSchema);

export { Post, PostStatus }