import mongoose from "mongoose";
import { Types} from "mongoose";
import { Order, OrderStatus } from "./order";
import { updateIfCurrentPlugin } from "mongoose-update-if-current";

//TODO: make cardRefId unique

interface AiModelCardAttr {
    modelRefId: string;
    price: number;
    cardRefId: string;
    userId: string;
}

interface AiModelCardDocument extends mongoose.Document {
    modelRefId: string;
    price: number;
    cardRefId: string;
    userId: string;
    version?: number;
    isAvailable(): Promise<boolean>;
}

interface AiModelCardModel extends mongoose.Model<AiModelCardDocument>{
    add(attrs: AiModelCardAttr): AiModelCardDocument;
    findByEvent(event: {id: string, version: number}): Promise<AiModelCardDocument | null>
}

interface DummyRet {
    _id: Types.ObjectId | undefined;
    id?: Types.ObjectId | undefined;
    userId: string | undefined;
    cardRefId: string | undefined;
    modelRefId: string | undefined;
    __v: number | undefined;
}

const aiModelCardSchema = new mongoose.Schema({
    modelRefId:{
        type: String,
        required: true,
    },
    price: {
        type: Number,
        required: true,
        min:0
    },
    cardRefId: {
        type: String,
        required: true
    },
    userId:{
        type: String,
        required: true
    }
}, {
    toJSON: {
        transform(doc,ret: DummyRet){
            ret.id = ret._id;
            delete ret._id;
            delete ret.userId;
            delete ret.cardRefId;
            delete ret.modelRefId;
        }
    }
})

aiModelCardSchema.set('versionKey', 'version');
aiModelCardSchema.plugin(updateIfCurrentPlugin);

aiModelCardSchema.statics.add = (attr: AiModelCardAttr)=>{
    return new AiModelCard(attr);
}


aiModelCardSchema.statics.findByEvent = (event: {id: string, version: number})=>{
    return AiModelCard.findOne({
        cardRefId: event.id,
        version: event.version -1,
    });
}


aiModelCardSchema.methods.isAvailable = async function(){
         const orderPlaced = await Order.findOne({
            aiModelCard:this,
            status: {
                $in:[
                    OrderStatus.Created,
                    OrderStatus.WaitingPayment,
                    OrderStatus.Completed
                ],
            },
        });
    return !orderPlaced
}

const AiModelCard = mongoose.model<AiModelCardDocument, AiModelCardModel>('AiModelCard', aiModelCardSchema);

export { AiModelCard, AiModelCardDocument };