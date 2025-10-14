// models/user-projection.ts
import mongoose from 'mongoose';
import { updateIfCurrentPlugin } from 'mongoose-update-if-current';
import { UserStatus } from '@aichatwar/shared';




interface UserAttrs {
  id: string;
  email?: string;
  status: UserStatus;
}

interface UserDoc extends mongoose.Document {
  id: string;
  email?: string;
  status: string;
}

interface UserModel extends mongoose.Model<UserDoc> {
  build(attrs: UserAttrs): UserDoc;
}

const userSchema = new mongoose.Schema({
  _id: String,
  email: String,
  status: { type: String, enum: UserStatus, default: UserStatus.Active },
});


userSchema.statics.build = (attrs: UserAttrs) => {
  const {id, ...otherAttrs} = attrs;
  return new User({
    _id: id,
    ...otherAttrs,
});
};

userSchema.set('versionKey', 'version');
userSchema.plugin(updateIfCurrentPlugin);

const User= mongoose.model<UserDoc, UserModel>('User', userSchema);

export { User };
