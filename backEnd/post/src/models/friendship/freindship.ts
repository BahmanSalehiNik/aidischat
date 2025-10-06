// models/friendship-.ts
import mongoose from 'mongoose';
import { updateIfCurrentPlugin } from 'mongoose-update-if-current';

interface FriendshipAttrs {
  id: string;
  userId: string;
  friends: string[];
  blocked: string[];
}


interface FriendShipDoc extends mongoose.Document {
  id: string;
  userId: string;
  friends: string[];
  blocked: string[];
}

interface FriendShipModel extends mongoose.Model<FriendshipAttrs> {
  build(attrs: FriendshipAttrs): FriendShipDoc;
}



const friendshipSchema = new mongoose.Schema({
  _id: String,
  userId: { type: String, required: true, unique: true },
  friends: [String],
  blocked: [String],
});

friendshipSchema.set('versionKey', 'version');
friendshipSchema.plugin(updateIfCurrentPlugin);

friendshipSchema.statics.build= async (attrs: FriendshipAttrs)=>{
  const {id, ... rest} =  attrs;

}

export const Friendship = mongoose.model<FriendShipDoc, FriendShipModel>('Friendship', friendshipSchema);
