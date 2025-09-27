import mongoose, { Types } from "mongoose";


interface UserAttrs {
    email: string;
}

interface UserDoc extends mongoose.Document {
    email: string;
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
    }
}, {
    toJSON:{
        transform(doc, ret: DummyRet){
            ret.id = ret._id;
            delete ret._id;
            delete ret.__v;
        }
    }
})



userSchame.statics.add = (attrs: UserAttrs) => {
    return new User(attrs)
};


const User = mongoose.model<UserDoc, UserModel>('User', userSchame);


export { User, UserDoc };