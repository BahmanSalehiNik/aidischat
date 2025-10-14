import mongoose, { Types } from 'mongoose';
import { updateIfCurrentPlugin } from 'mongoose-update-if-current';
import { FriendshipStatus } from '@aichatwar/shared';

// ----------------------------------
// Status Enum 
// ----------------------------------



// ----------------------------------
// Attributes required to create a Friend document
// ----------------------------------
interface FriendshipAttrs {
  id: string;
  requester: string;              // global userId
  recipient: string;              // global userId
  status: FriendshipStatus;
  version?: number;
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
  status: FriendshipStatus;
  version: number;
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
    status: {
      type: String,
      enum: Object.values(FriendshipStatus),
      default: FriendshipStatus.Pending,
    }
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
friendshipSchema.statics.build = async (attrs: FriendshipAttrs) =>{
  const {id,version,...rest} = attrs;
  console.log(version, "secret version");
  return new Friendship({
    _id: id,
    ...rest
  });
  }
const Friendship = mongoose.model<FriendshipDoc, FriendshipModel>(
  'Friendship',
  friendshipSchema
);


export { Friendship, FriendshipStatus }