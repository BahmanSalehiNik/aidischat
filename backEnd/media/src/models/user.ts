import mongoose from 'mongoose';
import { updateIfCurrentPlugin } from 'mongoose-update-if-current';
import { UserStatus } from '@aichatwar/shared';

interface UserAttrs {
  id: string;
  email: string;
  status: UserStatus;
  version: number;
}

interface UserDoc extends mongoose.Document {
  id: string;
  email: string;
  status: UserStatus;
  version: number;
}

interface UserModel extends mongoose.Model<UserDoc> {
  build(attrs: UserAttrs): UserDoc;
  findByEvent(event: { id: string; version: number }): Promise<UserDoc | null>;
}

const userSchema = new mongoose.Schema({
  _id: String,
  email: { type: String, required: true },
  status: { type: String, enum: Object.values(UserStatus), default: UserStatus.Active },
  version: Number
});

userSchema.set('versionKey', 'version');
userSchema.plugin(updateIfCurrentPlugin);

userSchema.statics.build = (attrs: UserAttrs) => {
  return new User({
    _id: attrs.id,
    email: attrs.email,
    status: attrs.status,
    version: attrs.version
  });
};

userSchema.statics.findByEvent = (event: { id: string; version: number }) => {
  return User.findOne({
    _id: event.id,
    version: event.version - 1
  });
};

const User = mongoose.model<UserDoc, UserModel>('User', userSchema);

export { User };
