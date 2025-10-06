// models/user-projection.ts
import mongoose from 'mongoose';
import { updateIfCurrentPlugin } from 'mongoose-update-if-current';

// todo add this to @shared
interface UserAttrs {
  id: string;
  email?: string;
  name: string;
  status: 'active' | 'suspended' | 'deleted';
}

interface UserDoc extends mongoose.Document {
  id: string;
  email?: string;
  name: string;
  status: string;
}

interface UserModel extends mongoose.Model<UserDoc> {
  build(attrs: UserAttrs): UserDoc;
}

const userSchema = new mongoose.Schema({
  _id: String,
  name: { type: String, required: true },
  email: String,
  status: { type: String, enum: ['active', 'suspended', 'deleted'], default: 'active' },
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

const User= mongoose.model<UserDoc, UserModel>('UserProjection', userSchema);

export { User };
