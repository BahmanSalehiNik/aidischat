import mongoose from 'mongoose';
import { updateIfCurrentPlugin } from "mongoose-update-if-current";
import { Visibility } from '@aichatwar/shared';
//import { UserDoc } from './user'; // <-- Import your User model's interface

//
// 1️⃣ Interfaces
//

// Attributes required to create a new Profile
export interface ProfileAttrs {
  id:string;
  user: mongoose.Types.ObjectId;
  username: string;
  fullName: string;
  bio?: string;
  birthday?: Date;
  gender?: 'male' | 'female' | 'non-binary' | 'other';
  location?: {
    city?: string;
    country?: string;
    coordinates?: [number, number];   // [lng, lat]
  };
  profilePicture?: {
    url: string;
    publicId?: string;
  };
  coverPhoto?: {
    url: string;
    publicId?: string;
  };
  privacy?: {
    profileVisibility?: Visibility;
    postDefault?: Visibility;
  };
}

// Document returned from Mongo
export interface ProfileDoc extends mongoose.Document {
  user: mongoose.Types.ObjectId;
  username: string;
  fullName: string;
  bio?: string;
  birthday?: Date;
  gender?: 'male' | 'female' | 'non-binary' | 'other';
  location?: {
    city?: string;
    country?: string;
    coordinates?: [number, number];
  };
  profilePicture?: {
    url: string;
    publicId?: string;
  };
  coverPhoto?: {
    url: string;
    publicId?: string;
  };

  privacy: {
    profileVisibility: Visibility;
    postDefault: Visibility;
  };
}

// Model interface (collection) with custom add method
export interface ProfileModel extends mongoose.Model<ProfileDoc> {
  add(attrs: ProfileAttrs): ProfileDoc;
  search(query: string): Promise<ProfileDoc[]>;
}

//
// 2️⃣ Schema
//

const profileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    fullName: { type: String, required: true, trim: true },
    bio: { type: String, maxlength: 300 },
    birthday: Date,
    gender: { type: String, enum: ['male', 'female', 'non-binary', 'other'] },
    location: {
      city: String,
      country: String,
      coordinates: { type: [Number], default: undefined },
      
    },
    profilePicture: {
      url: String,
      publicId: String,
    },
    coverPhoto: {
      url: String,
      publicId: String,
    },
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
  },
  {
    // versionKey: 'version',          // use 'version' instead of __v
    // optimisticConcurrency: true,    // built-in OCC
    timestamps: true,
    toJSON: {
      transform(doc, ret: any) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.version;         // hide version from API
      },
    },
  }
);


profileSchema.set('versionKey', 'version');
profileSchema.plugin(updateIfCurrentPlugin);
//
// 3️⃣ Static Methods
//

profileSchema.statics.add = (attrs: ProfileAttrs) => {
const { id, ...rest } = attrs;
  return new Profile({
    _id: id,
    ...rest,
  });
};

profileSchema.statics.search = function (query: string) {
  const regex = new RegExp(query, 'i');
  return this.find({
    $or: [{ username: regex }, { fullName: regex }],
  });
};

//
// 4️⃣ Model
//

export const Profile = mongoose.model<ProfileDoc, ProfileModel>(
  'Profile',
  profileSchema
);