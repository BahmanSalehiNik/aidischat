// models/post.ts
import mongoose, { Types } from 'mongoose';
import {Visability } from '@aichatwar/shared'

enum PostStatus{
  Active = 'active',
  Deleted = 'deleted',
  Removed = 'removed',
  Archived = 'archived'
}


interface DummyRet {
    _id: Types.ObjectId | undefined;
    id?: Types.ObjectId | undefined;
}


interface PostAttrs {
  id: string;
  userId: string;
  content: string;
  mediaIds?: string[];
  visibility:Visability;
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
  status: PostStatus
}

interface PostModel extends mongoose.Model<PostDoc>{
  build(attr: PostAttrs): PostDoc;
}




const postSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    content: { type: String, required: true },
    mediaIds: [String],
    visibility: { type: String, Visability, default: 'public' },
    reactions: [{ userId: String, type: String }],
    status: {
      type: String,
      enum: PostStatus,
      default: PostStatus.Active
    }
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

postSchema.statics.build = async(attrs: PostAttrs)=>{
  const {id, ...rest} = attrs;
  return new Post({
    _id: id,
    ...rest
  })

}

const Post = mongoose.model<PostDoc, PostModel>('Post', postSchema);

export { Post, PostStatus }