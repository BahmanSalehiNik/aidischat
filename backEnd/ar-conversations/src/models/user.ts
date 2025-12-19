// src/models/user.ts
import mongoose from 'mongoose';

interface UserAttrs {
  id: string;
  email: string;
  displayName?: string;
  username?: string;
  isAgent?: boolean;
  ownerUserId?: string;
}

interface UserDoc extends mongoose.Document {
  email: string;
  displayName?: string;
  username?: string;
  isAgent?: boolean;
  ownerUserId?: string;
}

interface UserModel extends mongoose.Model<UserDoc> {
  build(attrs: UserAttrs): UserDoc;
}

const userSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  email: { type: String, required: true },
  displayName: { type: String },
  username: { type: String },
  isAgent: { type: Boolean, default: false },
  ownerUserId: { type: String },
}, {
  toJSON: {
    transform(_doc, ret: any) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
    }
  }
});

userSchema.statics.build = (attrs: UserAttrs) => {
  return new User({
    _id: attrs.id,
    email: attrs.email,
    displayName: attrs.displayName,
    username: attrs.username,
    isAgent: attrs.isAgent,
    ownerUserId: attrs.ownerUserId,
  });
};

export const User = mongoose.model<UserDoc, UserModel>('User', userSchema);
