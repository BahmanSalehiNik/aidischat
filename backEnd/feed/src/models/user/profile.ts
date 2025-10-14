// models/profile-.ts
import mongoose, { Types } from 'mongoose';
import { updateIfCurrentPlugin } from 'mongoose-update-if-current';
import { Visability } from '@aichatwar/shared'



interface ProfileAttrs {
  id: string;
  userId: string;
  avatarUrl?: string;
  privacy?: {
    profileVisibility?: Visability;
    postDefault?: Visability;
  };
  username: string;
  version: number;
}

interface DummyRet {
    _id: Types.ObjectId | undefined;
    id?: Types.ObjectId | undefined;
    __v: number | undefined;
}

interface ProfileDoc extends mongoose.Document<ProfileAttrs>{
  id: string;
  userId: string;
  avatarUrl?: string;
  privacy: {
    profileVisibility: Visability;
    postDefault: Visability;
  };
  username: string;
  version: number;

}

interface ProfileModel extends mongoose.Model<ProfileDoc>{
      build(attrs: ProfileAttrs): ProfileDoc;
}

const profileSchema = new mongoose.Schema({
  _id: String,
  userId: { type: String, required: true },
  avatarUrl: String,
  privacy: {
      profileVisibility: {
        type: String,
        enum: Visability,
        default: Visability.Public,
      },
      postDefault: {
        type: String,
        enum: Visability,
        default: Visability.Friends,
      },
    },
  version: Number,
  username: {type: String, required: true}
});

profileSchema.set('versionKey', 'version');
profileSchema.plugin(updateIfCurrentPlugin);


profileSchema.statics.build = async (attrs: ProfileAttrs)=>{
    const {id, ...rest} = attrs;
    return new Profile({
        _id: id,
        ...rest,
    });
}



const Profile = mongoose.model<ProfileDoc, ProfileModel>('Profile', profileSchema);

export { Profile };