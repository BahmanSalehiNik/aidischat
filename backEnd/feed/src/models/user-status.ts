import mongoose from 'mongoose';

interface UserStatusAttrs {
  userId: string;
  status: 'active' | 'deleted' | 'suspended' | 'banned' | 'deactive';
  isDeleted: boolean;
  isSuggestible: boolean;
  deletedAt?: Date;
  updatedAt: Date;
}

export interface UserStatusDoc extends mongoose.Document, UserStatusAttrs {}

interface UserStatusModel extends mongoose.Model<UserStatusDoc> {
  build(attrs: UserStatusAttrs): UserStatusDoc;
}

const userStatusSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    status: {
      type: String,
      enum: ['active', 'deleted', 'suspended', 'banned', 'deactive'],
      default: 'active',
    },
    isDeleted: { type: Boolean, default: false, index: true },
    isSuggestible: { type: Boolean, default: true, index: true },
    deletedAt: { type: Date, default: undefined },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

userStatusSchema.index({ isSuggestible: 1 });

userStatusSchema.statics.build = (attrs: UserStatusAttrs) =>
  new UserStatus(attrs);

const UserStatus = mongoose.model<UserStatusDoc, UserStatusModel>(
  'UserStatus',
  userStatusSchema
);

export { UserStatus };

