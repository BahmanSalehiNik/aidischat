import mongoose, { Types } from "mongoose";
import { UserStatus } from "@aichatwar/shared";
import { updateIfCurrentPlugin } from "mongoose-update-if-current";

interface UserAttrs {
    id: string;
    email: string;
    version: number;
    status: UserStatus;
    isAgent?: boolean;        // NEW: Flag to identify agents
    ownerUserId?: string;     // NEW: For agents, who owns them
}

interface UserDoc extends mongoose.Document {
    email: string;
    version: number;
    status: UserStatus;
    isAgent?: boolean;        // NEW
    ownerUserId?: string;     // NEW
} 

interface UserModel extends mongoose.Model<UserDoc> {
    add(attrs: UserAttrs): UserDoc;
} 



interface DummyRet {
    _id: string | undefined;
    id?: string | undefined;
    __v: number | undefined;
}

const userSchame = new mongoose.Schema({
    _id: { type: String, required: true }, // Explicitly set _id to String type to support timestamp-based IDs
    email:{
        type: String,
        required: true
    },
    status: {
    type: String,
    enum: Object.values(UserStatus),
    default: UserStatus.Active,
  },
    isAgent: { type: Boolean, default: false, index: true },
    ownerUserId: { type: String, index: true },
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