import mongoose from "mongoose";
import { Types} from "mongoose";
import { OrderStatus } from "@aichatwar/shared";
import { AiModelCardDocument } from "./aiModelCard";


interface OrderAttrs{
    userId: string;
    status: OrderStatus;
    expirationDate: Date;
    aiModelCard: AiModelCardDocument;
}

interface OrderDocument extends mongoose.Document{
    userId: string;
    status: OrderStatus;
    expirationDate: Date;
    aiModelCard: AiModelCardDocument;
}

interface OrderModel extends mongoose.Model<OrderDocument> {
    add(attrs: OrderAttrs): OrderDocument;
}


interface DummyRet {
    _id: Types.ObjectId | undefined;
    id?: Types.ObjectId | undefined;
    userId: string | undefined;
    __v: number | undefined;
}


const orderSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true
    },
    status:{
        type: String,
        required: true,
        enum: Object.values(OrderStatus),
        default: OrderStatus.Created 
    },
    expirationDate: {
        type: mongoose.Schema.Types.Date,
        required: false
    },
    aiModelCard: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AiModelCard'
    }  
},{
    toJSON:{
        transform(doc, ret: DummyRet){
            ret.id = ret._id;
            delete ret._id;
        }
  }
})

orderSchema.statics.add = (attr: OrderAttrs)=>{
    return new Order(attr);
}

const Order = mongoose.model<OrderDocument, OrderModel>('Order', orderSchema);

export { Order, OrderStatus };