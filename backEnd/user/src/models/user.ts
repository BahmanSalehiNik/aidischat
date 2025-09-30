import mongoose from "mongoose";
import { Password } from "../utils/password";
import { Types } from "mongoose"
import { updateIfCurrentPlugin } from "mongoose-update-if-current";
import { UserStatus, Visability } from '@aichatwar/shared'


interface UserAttrs {
    email: string;
    password: string;
    status?: UserStatus; 
}

interface UserDoc extends mongoose.Document {
    email: string;
    password: string;
    status: UserStatus;
    version: number;
}

interface UserModel extends mongoose.Model<UserDoc> {
    add(attrs: UserAttrs): UserDoc;
} 



interface DummyRet {
    _id: Types.ObjectId | undefined;
    id?: Types.ObjectId | undefined;
    password: string | undefined;
    __v: number | undefined;
}

const userSchame = new mongoose.Schema({
    email:{
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    status: {
    type: String,
    enum: Object.values(UserStatus),
    default: UserStatus.Active,
  },
    }, {
    timestamps: true,
    toJSON:{
        transform(doc, ret: DummyRet){
            ret.id = ret._id;
            delete ret._id;
            delete ret.password;
            delete ret.__v;
        }
    }
})

userSchame.set('versionKey','version')
userSchame.plugin(updateIfCurrentPlugin);

userSchame.pre('save', async function(done) {
    if(this.isModified('password')){
        const hashed = await Password.hash(this.get('password'))
        this.set('password', hashed);
    }
    done();
})

userSchame.statics.add = (attrs: UserAttrs) => {
    return new User(attrs)
};




const User = mongoose.model<UserDoc, UserModel>('User', userSchame);


export { User, UserDoc };