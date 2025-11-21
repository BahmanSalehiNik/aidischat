import mongoose from 'mongoose';

interface NewUserAttrs {
  userId: string;
  username?: string;
  fullName?: string;
  createdAtMs: number;
}

export interface NewUserDoc extends mongoose.Document, NewUserAttrs {}

interface NewUserModel extends mongoose.Model<NewUserDoc> {
  build(attrs: NewUserAttrs): NewUserDoc;
}

const newUserSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true },
    username: String,
    fullName: String,
    createdAtMs: { type: Number, required: true },
  },
  { timestamps: true }
);

newUserSchema.statics.build = (attrs: NewUserAttrs) => new NewUser(attrs);

const NewUser = mongoose.model<NewUserDoc, NewUserModel>('NewUser', newUserSchema);

export { NewUser };

