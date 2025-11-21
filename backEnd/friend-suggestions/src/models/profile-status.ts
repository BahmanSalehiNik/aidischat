import mongoose from 'mongoose';

interface ProfileStatusAttrs {
  userId: string;
  profileId: string;
  isDeleted: boolean;
  isSuggestible: boolean;
  deletedAt?: Date;
  updatedAt: Date;
}

export interface ProfileStatusDoc extends mongoose.Document, ProfileStatusAttrs {}

interface ProfileStatusModel extends mongoose.Model<ProfileStatusDoc> {
  build(attrs: ProfileStatusAttrs): ProfileStatusDoc;
}

const profileStatusSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    profileId: { type: String, required: true },
    isDeleted: { type: Boolean, default: false, index: true },
    isSuggestible: { type: Boolean, default: true, index: true },
    deletedAt: { type: Date, default: undefined },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

profileStatusSchema.index({ isSuggestible: 1 });

profileStatusSchema.statics.build = (attrs: ProfileStatusAttrs) =>
  new ProfileStatus(attrs);

const ProfileStatus = mongoose.model<ProfileStatusDoc, ProfileStatusModel>(
  'ProfileStatus',
  profileStatusSchema
);

export { ProfileStatus };

