// models/profile-.ts
import mongoose, { Types } from 'mongoose';
import { updateIfCurrentPlugin } from 'mongoose-update-if-current';
// Todo: add visibility to shared module import {Visibility} from '@aichatwar/shared'



interface ProfileAttrs {
  id: string;
  userId: string;
  avatarUrl?: string;
  visibility: 'public' | 'friends' | 'private';
  version: number;
}

interface DummyRet {
    _id: Types.ObjectId | undefined;
    id?: Types.ObjectId | undefined;
    __v: number | undefined;
}

interface ProfileDoc extends mongoose.Document<ProfileAttrs>{

}

interface ProfileModel extends mongoose.Model<ProfileDoc>{

}

const profileSchema = new mongoose.Schema({
  _id: String,
  userId: { type: String, required: true },
  avatarUrl: String,
  visibility: { type: String, enum: ['public', 'friends', 'private'], default: 'public' },
  version: Number
});

profileSchema.set('versionKey', 'version');
profileSchema.plugin(updateIfCurrentPlugin);


profileSchema.statics.build= async (attrs: ProfileAttrs)=>{
    const {id, ...rest} = attrs;
    return new Profile({
        _id: id,
        ...rest,
    });
}



const Profile = mongoose.model('Profile', profileSchema);

export { Profile };