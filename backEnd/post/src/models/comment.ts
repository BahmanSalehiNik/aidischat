import mongoose, { Types } from 'mongoose';

export interface CommentAttrs {
  userId: string;
  text: string;
}

interface DummyRet {
    _id: Types.ObjectId | undefined;
    id?: Types.ObjectId | undefined;
    __v: number | undefined;
}

export interface CommentDoc extends mongoose.Document {
  userId: string;
  text: string;
  deleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

const commentSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    text: { type: String, required: true },
    deleted: { type: Boolean, default: false },
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
