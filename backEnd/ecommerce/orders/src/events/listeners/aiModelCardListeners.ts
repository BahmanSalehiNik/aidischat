import { Message } from "node-nats-streaming";
import { EcommerceModelCreatedEvent, EcommerceOrderCancelledEvent, Subjects, BaseListener, EcommerceModelUpdatedEvent, EcommerceOrderExpiredEvent, NotFoundError, OrderStatus } from "@aichatwar/shared";
import { AiModelCard } from "../../models/aiModelCard";
import { orderAiModelCardQueueGroupeName } from "./queGroupNames";
import { Order } from "../../models/order";

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
        //const updatedCard  = await AiModelCard.find({cardRefId:id, version: version - 1})[0];
        const tempEvent = {id, version}
        const updatedCard  = await AiModelCard.findByEvent(tempEvent);
        if (!updatedCard){
            throw new Error('ai model card not found! or did it?')
        }
        updatedCard.set( 
        { 
            // modelRefId:modelId, 
            // userId:JSON.parse(userId).id, 
            price:price,
            rank: rank
        }
    )
        await updatedCard.save()

        msg.ack();
    }
}


class EcommerceOrderExpiredListener extends BaseListener<EcommerceOrderExpiredEvent>{
    readonly subject: Subjects.EcommerceOrderExpired = Subjects.EcommerceOrderExpired;
    queueGroupName: string = orderAiModelCardQueueGroupeName;
    async onMessage(processedMessage: { id: string; }, msg: Message) {
        // change the order status to expired
        // TODO: how about versioning?
        const order = await Order.findById(processedMessage.id);
        if (!order){
            throw new NotFoundError();
        }
        order.set('status', OrderStatus.Expired);
        await order.save();

        msg.ack()

    }
}

export { AiModelCardCreatedListener, AiModelCardUpdatedListener };