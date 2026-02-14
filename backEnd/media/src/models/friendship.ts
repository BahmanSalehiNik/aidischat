import mongoose from 'mongoose';
import { updateIfCurrentPlugin } from 'mongoose-update-if-current';
import { FriendshipStatus } from '@aichatwar/shared';

interface FriendshipAttrs {
  id: string;
  requester: string;
  recipient: string;
  status: FriendshipStatus;
  version: number;
}

export interface FriendshipDoc extends mongoose.Document {
  requester: string;
  recipient: string;
  status: FriendshipStatus;
  version: number;
}

interface FriendshipModel extends mongoose.Model<FriendshipDoc> {
  build(attrs: FriendshipAttrs): FriendshipDoc;
  findByEvent(event: { id: string; version: number }): Promise<FriendshipDoc | null>;
}

const friendshipSchema = new mongoose.Schema({
  _id: String,
  requester: { type: String, required: true, index: true },
  recipient: { type: String, required: true, index: true },
  status: { type: String, enum: Object.values(FriendshipStatus), required: true, index: true },
  version: { type: Number, required: true },
});

friendshipSchema.set('versionKey', 'version');
friendshipSchema.plugin(updateIfCurrentPlugin);

friendshipSchema.statics.build = (attrs: FriendshipAttrs) => {
  return new Friendship({
    _id: attrs.id,
    requester: attrs.requester,
    recipient: attrs.recipient,
    status: attrs.status,
    version: attrs.version,
  });
};

friendshipSchema.statics.findByEvent = (event: { id: string; version: number }) => {
  return Friendship.findOne({
    _id: event.id,
    version: event.version - 1,
  });
};

const Friendship = mongoose.model<FriendshipDoc, FriendshipModel>('Friendship', friendshipSchema);

export { Friendship };






