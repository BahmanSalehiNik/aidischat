import mongoose from 'mongoose';

interface UserSearchAttrs {
  userId: string;
  name: string;
  username: string;
  bio?: string;
  profilePicture?: string;
}

export interface UserSearchDoc extends mongoose.Document, UserSearchAttrs {}

interface UserSearchModel extends mongoose.Model<UserSearchDoc> {
  build(attrs: UserSearchAttrs): UserSearchDoc;
}

const userSearchSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    username: { type: String, required: true },
    bio: String,
    profilePicture: String,
  },
  { timestamps: true }
);

userSearchSchema.index({ name: 'text', username: 'text', bio: 'text' });

userSearchSchema.statics.build = (attrs: UserSearchAttrs) => new UserSearch(attrs);

const UserSearch = mongoose.model<UserSearchDoc, UserSearchModel>('UserSearch', userSearchSchema);

export { UserSearch };

