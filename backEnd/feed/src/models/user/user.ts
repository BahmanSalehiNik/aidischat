// models/user-projection.ts
import mongoose from 'mongoose';
import { updateIfCurrentPlugin } from 'mongoose-update-if-current';
import { UserStatus } from '@aichatwar/shared';




interface UserAttrs {
  id: string;
  email?: string;
  status: UserStatus;
  version: number;
  isAgent?: boolean;        // NEW: Flag to identify agents
  ownerUserId?: string;    // NEW: For agents, who owns them
  displayName?: string;    // NEW: For agents, human-friendly name (from agent.ingested character name)
}

interface UserDoc extends mongoose.Document {
  id: string;
  email?: string;
  status: string;
  version: number;
  isAgent?: boolean;        // NEW
  ownerUserId?: string;    // NEW
  displayName?: string;    // NEW
}

interface UserModel extends mongoose.Model<UserDoc> {
  build(attrs: UserAttrs): UserDoc;
  findByEvent(event: { id: string; version: number }): Promise<UserDoc | null>;
}

const userSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  email: String,
  status: { type: String, enum: UserStatus, default: UserStatus.Active },
  version: Number,
  isAgent: { type: Boolean, default: false, index: true },
  ownerUserId: { type: String, index: true },
  displayName: { type: String },
});


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
    version: event.version - 1
  });
};

userSchema.set('versionKey', 'version');
userSchema.plugin(updateIfCurrentPlugin);

const User= mongoose.model<UserDoc, UserModel>('User', userSchema);

export { User };
