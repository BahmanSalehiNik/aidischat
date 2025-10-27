import mongoose, { Types } from "mongoose";
import { updateIfCurrentPlugin } from "mongoose-update-if-current";

// Define UserStatus locally for now
enum UserStatus {
  Active = 'active',
  Suspended = 'suspended',
  Banned = 'banned',
  Deleted = 'deleted',
  Deactive = 'deactive'
}

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
    deletedAt?: Date;
    isDeleted: boolean;
} 

interface UserModel extends mongoose.Model<UserDoc> {
    add(attrs: UserAttrs): UserDoc;
} 

interface DummyRet {
    _id: Types.ObjectId | undefined;
    id?: Types.ObjectId | undefined;
    __v: number | undefined;
}

const userSchema = new mongoose.Schema({
    email:{
        type: String,
        required: true
    },
    status: {
    type: String,
    enum: Object.values(UserStatus),
    default: UserStatus.Active,
  },
    deletedAt: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false, index: true },
}, {
    toJSON:{
        transform(doc, ret: DummyRet){
            ret.id = ret._id;
            delete ret._id;
            delete ret.__v;
        }
    }
})

userSchema.set('versionKey','version')
userSchema.plugin(updateIfCurrentPlugin);

userSchema.statics.add = (attrs: UserAttrs) => {
  const { id, ...rest } = attrs;
  return new User({
    _id: id,
    ...rest,
  });
};

const User = mongoose.model<UserDoc, UserModel>('User', userSchema);

export { User, UserDoc };
