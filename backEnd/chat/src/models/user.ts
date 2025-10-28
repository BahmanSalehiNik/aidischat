// src/models/user.ts
import mongoose from 'mongoose';

interface UserAttrs {
  id: string;
  email: string;
  username?: string;
  displayName?: string;
  avatar?: string;
  isActive: boolean;
}

interface UserDoc extends mongoose.Document {
  email: string;
  username?: string;
  displayName?: string;
  avatar?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface UserModel extends mongoose.Model<UserDoc> {
  build(attrs: UserAttrs): UserDoc;
}

const userSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  username: { type: String, unique: true, sparse: true },
  displayName: { type: String },
  avatar: { type: String },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, {
  toJSON: {
    transform(_doc, ret: any) {
      ret.id = ret._id;
      delete ret._id;
    }
  }
});

userSchema.statics.build = (attrs: UserAttrs) => new User({ _id: attrs.id, ...attrs });

export const User = mongoose.model<UserDoc, UserModel>('User', userSchema);
