import mongoose from "mongoose";
import { Password } from "../utils/password";


interface UserAttrs {
    email: string;
    password: string;
}

interface UserDoc extends mongoose.Document {
    email: string;
    password: string;
} 

interface UserModel extends mongoose.Model<UserDoc> {
    add(attrs: UserAttrs): UserDoc;
}





const userSchame = new mongoose.Schema({
    email:{
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true
    }
})

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


export { User };