import { Message } from "node-nats-streaming";
import { EcommerceModelCreatedEvent, EcommerceOrderCancelledEvent, Subjects, BaseListener, EcommerceModelUpdatedEvent } from "@aichatwar/shared";
import { AiModelCard } from "../../models/aiModelCard";
import { orderAiModelCardQueueGroupeName } from "./queGroupNames";

class AiModelCardCreatedListener extends BaseListener<EcommerceModelCreatedEvent>{
    readonly subject: Subjects.EcommerceModelCreated =  Subjects.EcommerceModelCreated;
    queueGroupName: string = orderAiModelCardQueueGroupeName;
    async onMessage(processedMessage: EcommerceModelCreatedEvent['data'] , msg: Message){
        const {id, modelId, price, userId} = processedMessage;
        const card = AiModelCard.add({
            cardRefId: id,
            modelRefId: modelId,
            price : price,
            userId: JSON.parse(userId).id
        })
        await card.save()
        msg.ack();
    }
}

class AiModelCardUpdatedListener extends BaseListener<EcommerceModelUpdatedEvent>{
    readonly subject: Subjects.EcommerceModelUpdated =  Subjects.EcommerceModelUpdated;
    queueGroupName: string = orderAiModelCardQueueGroupeName;
    async onMessage(processedMessage: EcommerceModelUpdatedEvent['data'] , msg: Message){
        const {id, rank, modelId, price, userId, version} = processedMessage;

        const updatedCard  = await AiModelCard.find({cardRefId:id, version: version - 1});
        if (!updatedCard){
            throw new Error('ai model card nopt found!')
        }
        updatedCard[0].set( 
        { 
            modelRefId:modelId, 
            userId:JSON.parse(userId).id, 
            price:price,
        }
    )
        await updatedCard[0].save()

        msg.ack();
    }
}


export { AiModelCardCreatedListener, AiModelCardUpdatedListener };