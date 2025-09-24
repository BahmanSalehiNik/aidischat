import mongoose, { Types, Document, Model } from 'mongoose';
import { updateIfCurrentPlugin } from "mongoose-update-if-current";

// Properties required to create a new Profile
export interface ProfileAttrs {
  user: mongoose.Types.ObjectId;       // reference to User auth model
  username: string;
  fullName: string;
  bio?: string;
  birthday?: Date;
  gender?: 'male' | 'female' | 'non-binary' | 'other';
  location?: {
    city?: string;
    country?: string;
    coordinates?: {
      type: 'Point';
      coordinates: [number, number];   // [lng, lat]
    };
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
    profileVisibility?: 'public' | 'friends' | 'private';
    postDefault?: 'public' | 'friends' | 'private';
  };
}


interface DummyRet {
    _id: Types.ObjectId | undefined;
    id?: Types.ObjectId | undefined;
    __v: number | undefined;
}

// A single Profile document returned from Mongo
export interface ProfileDoc extends Document {
  user: mongoose.Types.ObjectId;
  username: string;
  fullName: string;
  bio?: string;
  birthday?: Date;
  gender?: 'male' | 'female' | 'non-binary' | 'other';
  location?: {
    city?: string;
    country?: string;
    coordinates?: {
      type: 'Point';
      coordinates: [number, number];
    };
  };
  profilePicture?: {
    url: string;
    publicId?: string;
  };
  coverPhoto?: {
    url: string;
    publicId?: string;
  };
  friends: mongoose.Types.ObjectId[];
  friendRequests: { from: mongoose.Types.ObjectId; createdAt: Date }[];
  followers: mongoose.Types.ObjectId[];
  following: mongoose.Types.ObjectId[];
  privacy: {
    profileVisibility: 'public' | 'friends' | 'private';
    postDefault: 'public' | 'friends' | 'private';
  };
  status: 'active' | 'inactive' | 'banned';
  createdAt: Date;
  updatedAt: Date;

  // Instance methods
  isFriend(userId: mongoose.Types.ObjectId): boolean;
  sendFriendRequest(targetProfileId: mongoose.Types.ObjectId): Promise<void>;
  acceptFriendRequest(fromUserId: mongoose.Types.ObjectId): Promise<void>;
}

// The Profile model itself (collection) with a custom build method
export interface ProfileModel extends Model<ProfileDoc> {
  build(attrs: ProfileAttrs): ProfileDoc;
  search(query: string): Promise<ProfileDoc[]>;
}



const profileSchema = new mongoose.Schema<ProfileDoc, ProfileModel>(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    fullName: { type: String, required: true, trim: true },
    bio: { type: String, maxlength: 300 },
    birthday: Date,
    gender: { type: String, enum: ['male', 'female', 'non-binary', 'other'] },
    location: {
      city: String,
      country: String,
      coordinates: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], default: undefined },
      },
    },
    profilePicture: {
      url: String,
      publicId: String,
    },
    coverPhoto: {
      url: String,
      publicId: String,
    },
    friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    friendRequests: [
      {
        from: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    privacy: {
      profileVisibility: {
        type: String,
        enum: ['public', 'friends', 'private'],
        default: 'public',
      },
      postDefault: {
        type: String,
        enum: ['public', 'friends', 'private'],
        default: 'friends',
      },
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'banned'],
      default: 'active',
    },
  },
  {
    timestamps: true,
    versionKey: 'version',          
    optimisticConcurrency: true,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete (ret as any).version;
      },
    },
  }
);



profileSchema.methods.isFriend = function (this: ProfileDoc, userId: mongoose.Types.ObjectId) {
  return this.friends.some((id) => id.equals(userId));
};

profileSchema.methods.sendFriendRequest = async function (
  this: ProfileDoc,
  targetProfileId: mongoose.Types.ObjectId
) {
  const target = await Profile.findById(targetProfileId);
  if (!target) throw new Error('Target profile not found');

  if (!target.friendRequests.some((r) => r.from.equals(this.user))) {
    target.friendRequests.push({ from: this.user, createdAt: new Date() });
    await target.save();
  }
};

profileSchema.methods.acceptFriendRequest = async function (
  this: ProfileDoc,
  fromUserId: mongoose.Types.ObjectId
) {
  const idx = this.friendRequests.findIndex((r) => r.from.equals(fromUserId));
  if (idx === -1) throw new Error('No request from this user');

  this.friendRequests.splice(idx, 1);
  this.friends.push(fromUserId);
  await this.save();

  const fromProfile = await Profile.findOne({ user: fromUserId });
  if (fromProfile && !fromProfile.friends.includes(this.user)) {
    fromProfile.friends.push(this.user);
    await fromProfile.save();
  }
};


profileSchema.statics.build = (attrs: ProfileAttrs) => {
  return new Profile(attrs);
};

profileSchema.statics.search = function (query: string) {
  const regex = new RegExp(query, 'i');
  return this.find({
    $or: [{ username: regex }, { fullName: regex }],
  });
};

export const Profile = mongoose.model<ProfileDoc, ProfileModel>('Profile', profileSchema);

// Usage Example
// import { Profile } from '../models/profile';

// // Creating a new profile with type safety
// const profile = Profile.build({
//   user: new mongoose.Types.ObjectId('64f9...'),
//   username: 'johndoe',
//   fullName: 'John Doe',
//   bio: 'Loves coding',
// });

// await profile.save();

// // Searching
// const results = await Profile.search('john');

// // Instance methods
// const isFriend = profile.isFriend(new mongoose.Types.ObjectId('...'));
// await profile.sendFriendRequest(new mongoose.Types.ObjectId('targetProfileId'));

// ProfileAttrs → creation requirements (compile-time safety).

// ProfileDoc → full document type (includes Mongo fields + methods).

// ProfileModel → model type (includes static build, search).

// The build static ensures you cannot create a profile with missing required fields at compile time.

