import mongoose from "mongoose";
import { Types } from "mongoose"


interface EcommerceModelAttrs{
    rank: number
    userId: string
    modelId: string
    price: number
}

interface EcommerceModleDoc extends mongoose.Document{
    rank: number
    userId: string
    modelId: string
    price: number
}

interface EcommerceModel extends mongoose.Model<EcommerceModleDoc>{
    add(attrs: EcommerceModelAttrs): EcommerceModleDoc
}


interface DummyRet {
    _id: Types.ObjectId | undefined;
    id?: Types.ObjectId | undefined;
    userId: string | undefined;
    __v: number | undefined;
}

const ecommerceModelSchema = new mongoose.Schema({
    rank:{
        type: Number,
        required: false
    },
    userId:{
        type: String,
        required: true
    },
    modelId: {
        type: String,
        required: true
    },
    price:{
        // TODO: price can be best bid or free as well
        type: Number,
        required: true 
    }
    
},{
        toJSON:{
            transform(doc, ret: DummyRet){
            ret.id = ret._id;
            delete ret._id;
            delete ret.userId;
            }
        }
    }
)





ecommerceModelSchema.statics.add = (attrs: EcommerceModelAttrs)=>{
    return new EcommerceModel(attrs)
}


const EcommerceModel = mongoose.model<EcommerceModleDoc, EcommerceModel>('EcommerceModel', ecommerceModelSchema)


export { EcommerceModel }