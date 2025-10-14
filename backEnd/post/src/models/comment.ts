import mongoose, { Types } from 'mongoose';

export interface CommentAttrs {
  postId: string;
  userId: string;
  text: string;
  parentCommentId?: string, // for threads/replies
}

interface DummyRet {
    _id: Types.ObjectId | undefined;
    id?: Types.ObjectId | undefined;
    __v: number | undefined;
}

export interface CommentDoc extends mongoose.Document {
  postId: string;
  userId: string;
  text: string;
  deleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  parentCommentId?: string, // for threads/replies
}

interface CommentModel extends mongoose.Model<CommentDoc>{
  build(attr: CommentAttrs): CommentDoc;
}

const commentSchema = new mongoose.Schema(
  {
    ostId: { type: String, required: true }, 
    userId: { type: String, required: true },
    text: { type: String, required: true },
    deleted: { type: Boolean, default: false },
    parentCommentId: {type:String,  required: false}// for threads/replies
  },
  {
    timestamps: true,
    versionKey: 'version',
    optimisticConcurrency: true,
    toJSON: {
      transform(doc, ret: DummyRet) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
      },
    },
  }
);

const Comment = mongoose.model<CommentDoc>('Comment', commentSchema);

export { commentSchema, Comment };
