// models/user-projection.ts
import mongoose from 'mongoose';
import { updateIfCurrentPlugin } from 'mongoose-update-if-current';
import { UserStatus } from '@aichatwar/shared';




interface UserAttrs {
  id: string;
  email?: string;
  status: UserStatus;
  isAgent?: boolean;        // NEW: Flag to identify agents
  ownerUserId?: string;     // NEW: For agents, who owns them
}

interface UserDoc extends mongoose.Document {
  id: string;
  email?: string;
  status: string;
  isAgent?: boolean;        // NEW
  ownerUserId?: string;    // NEW
}

interface UserModel extends mongoose.Model<UserDoc> {
  build(attrs: UserAttrs): UserDoc;
    findByEvent(event: {
    id: string;
    version: number;
  }): Promise<UserDoc | null>;
}

const userSchema = new mongoose.Schema({
  _id: String,
  email: String,
  status: { type: String, enum: UserStatus, default: UserStatus.Active },
  isAgent: { type: Boolean, default: false, index: true },
  ownerUserId: { type: String, index: true },
});


userSchema.set('versionKey', 'version');
userSchema.plugin(updateIfCurrentPlugin);

userSchema.statics.build = (attrs: UserAttrs) => {
  const {id, ...otherAttrs} = attrs;
  return new User({
    _id: id,
    ...otherAttrs,
});
};



userSchema.statics.findByEvent = (event: { id: string; version: number }) => {
  return User.findOne({
    _id: event.id,
    version: event.version - 1,
  });
};

const User= mongoose.model<UserDoc, UserModel>('User', userSchema);

export { User };
