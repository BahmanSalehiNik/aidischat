import mongoose, { Types } from 'mongoose';
import { updateIfCurrentPlugin } from 'mongoose-update-if-current';

// ----------------------------------
// Status Enum 
// ----------------------------------

// TODO: move this to shared folder

export enum FriendshipStatus {
  Pending = 'pending',
  Accepted = 'accepted',
  Declined = 'declined',
  Blocked = 'blocked',
}

// ----------------------------------
// Attributes required to create a Friend document
// ----------------------------------
interface FriendshipAttrs {
  requester: string;              // global userId
  recipient: string;              // global userId
  requesterProfile: string;       // ObjectId (local Profile replica)
  recipientProfile: string;       // ObjectId (local Profile replica)
  status?: FriendshipStatus;
  // snapshot?: {
  //   requesterName?: string;
  //   recipientName?: string;
  //   requesterPhotoUrl?: string;
  //   recipientPhotoUrl?: string;
  // };
}


interface DummyRet {
    _id: Types.ObjectId | undefined;
    id?: Types.ObjectId | undefined;
    __v: number | undefined;
}

// ----------------------------------
// Mongo Document
// ----------------------------------
export interface FriendshipDoc extends mongoose.Document {
  requester: string;
  recipient: string;
  requesterProfile: mongoose.Types.ObjectId;
  recipientProfile: mongoose.Types.ObjectId;
  status: FriendshipStatus;
  snapshot?: {
    requesterName?: string;
    recipientName?: string;
    requesterPhotoUrl?: string;
    recipientPhotoUrl?: string;
  };
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

// ----------------------------------
// Model Interface
// ----------------------------------
interface FriendshipModel extends mongoose.Model<FriendshipDoc> {
  build(attrs: FriendshipAttrs): FriendshipDoc;
}

// ----------------------------------
// Schema
// ----------------------------------
const friendshipSchema = new mongoose.Schema(
  {
    requester: { type: String, required: true},
    recipient: { type: String, required: true},
    requesterProfile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Profile',
      required: true,
      index: true,
    },
    recipientProfile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Profile',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(FriendshipStatus),
      default: FriendshipStatus.Pending,
    },
    snapshot: {
      requesterName: String,
      recipientName: String,
      requesterPhotoUrl: String,
      recipientPhotoUrl: String,
    },
  },
  {
    toJSON: {
      transform(doc, ret: DummyRet) {
        ret.id = ret._id;
        delete ret._id;
      },
    },
    // versionKey: 'version',
    timestamps: true,
  }
);


friendshipSchema.set('versionKey', 'version');
// Optimistic concurrency (like Stephan Grider’s examples)
friendshipSchema.plugin(updateIfCurrentPlugin);

// Custom build method for type-safe creation
friendshipSchema.statics.build = (attrs: FriendshipAttrs) =>
  new Friendship(attrs);

export const Friendship = mongoose.model<FriendshipDoc, FriendshipModel>(
  'Friendship',
  friendshipSchema
);