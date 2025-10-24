import mongoose from 'mongoose';
import { updateIfCurrentPlugin } from 'mongoose-update-if-current';
import { Visibility } from '@aichatwar/shared';

interface ProfileAttrs {
  id: string;
  userId: string;
  username: string;
  avatarUrl?: string;
  privacy: {
    profileVisibility: Visibility;
    postDefault: Visibility;
  };
  version: number;
}

interface ProfileDoc extends mongoose.Document {
  id: string;
  userId: string;
  username: string;
  avatarUrl?: string;
  privacy: {
    profileVisibility: Visibility;
    postDefault: Visibility;
  };
  version: number;
}

interface ProfileModel extends mongoose.Model<ProfileDoc> {
  build(attrs: ProfileAttrs): ProfileDoc;
  findByEvent(event: { id: string; version: number }): Promise<ProfileDoc | null>;
}

const profileSchema = new mongoose.Schema({
  _id: String,
  userId: { type: String, required: true },
  username: { type: String, required: true },
  avatarUrl: String,
  privacy: {
    profileVisibility: {
      type: String,
      enum: Visibility,
      default: Visibility.Public,
    },
    postDefault: {
      type: String,
      enum: Visibility,
      default: Visibility.Friends,
    },
  },
  version: Number
});

profileSchema.set('versionKey', 'version');
profileSchema.plugin(updateIfCurrentPlugin);

profileSchema.statics.build = (attrs: ProfileAttrs) => {
  return new Profile({
    _id: attrs.id,
    userId: attrs.userId,
    username: attrs.username,
    avatarUrl: attrs.avatarUrl,
    privacy: attrs.privacy,
    version: attrs.version
  });
};

profileSchema.statics.findByEvent = (event: { id: string; version: number }) => {
  return Profile.findOne({
    _id: event.id,
    version: event.version - 1
  });
};

const Profile = mongoose.model<ProfileDoc, ProfileModel>('Profile', profileSchema);

export { Profile };
