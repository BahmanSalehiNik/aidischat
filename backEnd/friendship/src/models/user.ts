import mongoose, { Types } from "mongoose";
import { UserStatus } from "@aichatwar/shared";
import { updateIfCurrentPlugin } from "mongoose-update-if-current";

interface UserAttrs {
    id: string;
    email: string;
    version: number;
    status: UserStatus;
}

interface UserDoc extends mongoose.Document {
    email: string;
    version: number;
    status: UserStatus;
} 

interface UserModel extends mongoose.Model<UserDoc> {
    add(attrs: UserAttrs): UserDoc;
} 



interface DummyRet {
    _id: Types.ObjectId | undefined;
    id?: Types.ObjectId | undefined;
    __v: number | undefined;
}

const userSchame = new mongoose.Schema({
    email:{
        type: String,
        required: true
    },
    status: {
    type: String,
    enum: Object.values(UserStatus),
    default: UserStatus.Active,
  },
}, {
    toJSON:{
        transform(doc, ret: DummyRet){
            ret.id = ret._id;
            delete ret._id;
            delete ret.__v;
        }
    }
})

userSchame.set('versionKey','version')
userSchame.plugin(updateIfCurrentPlugin);

userSchame.statics.add = (attrs: UserAttrs) => {
  const { id, ...rest } = attrs;
  return new User({
    _id: id,
    ...rest,
  });
};


const User = mongoose.model<UserDoc, UserModel>('User', userSchame);


export { User, UserDoc };