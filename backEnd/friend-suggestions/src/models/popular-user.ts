import mongoose from 'mongoose';

interface PopularUserAttrs {
  userId: string;
  username?: string;
  fullName?: string;
  profilePicture?: string;
  followersCount: number;
  profileViewsLast7d: number;
  score: number;
}

export interface PopularUserDoc extends mongoose.Document, PopularUserAttrs {}

interface PopularUserModel extends mongoose.Model<PopularUserDoc> {
  build(attrs: PopularUserAttrs): PopularUserDoc;
}

const popularUserSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true },
    username: String,
    fullName: String,
    profilePicture: String,
    followersCount: { type: Number, default: 0 },
    profileViewsLast7d: { type: Number, default: 0 },
    score: { type: Number, required: true },
  },
  { timestamps: true }
);

popularUserSchema.statics.build = (attrs: PopularUserAttrs) => new PopularUser(attrs);

const PopularUser = mongoose.model<PopularUserDoc, PopularUserModel>('PopularUser', popularUserSchema);

export { PopularUser };

