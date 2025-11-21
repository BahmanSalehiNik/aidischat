import mongoose from 'mongoose';

interface UserSocialStatsAttrs {
  userId: string;
  followersCount?: number;
  friendsCount?: number;
  profileViewsLast7d?: number;
}

export interface UserSocialStatsDoc extends mongoose.Document, UserSocialStatsAttrs {}

interface UserSocialStatsModel extends mongoose.Model<UserSocialStatsDoc> {
  build(attrs: UserSocialStatsAttrs): UserSocialStatsDoc;
}

const userSocialStatsSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true },
    followersCount: { type: Number, default: 0 },
    friendsCount: { type: Number, default: 0 },
    profileViewsLast7d: { type: Number, default: 0 },
  },
  { timestamps: true }
);

userSocialStatsSchema.statics.build = (attrs: UserSocialStatsAttrs) =>
  new UserSocialStats(attrs);

const UserSocialStats = mongoose.model<UserSocialStatsDoc, UserSocialStatsModel>(
  'UserSocialStats',
  userSocialStatsSchema
);

export { UserSocialStats };

