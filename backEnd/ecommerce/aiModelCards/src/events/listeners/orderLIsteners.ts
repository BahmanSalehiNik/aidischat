// when an order is created on a card the card must not be available for updates for a perid i.e: 2 mins
// if the order is canceled the card must become available again
// if the order is completed the card status must become unavailabel (todo:Sold)

import { BadRequestError, BaseListener, EcommerceOrderCancelledEvent,
     EcommerceOrderCreatedEvent, NotFoundError, Subjects, EcommerceOrderExpiredEvent } from "@aichatwar/shared";
import { AiModelCardQueueGroupeName } from "./queGroupNames";
import { Message } from "node-nats-streaming";
import { EcommerceModel } from "../../models/ecommerceModel";
import { EcommerceUpdatePublisher } from "../publishers/ecommercePublishers";

class OrderCreatedListener extends BaseListener<EcommerceOrderCreatedEvent>{
    readonly subject: Subjects.EcommerceOrderCreated =  Subjects.EcommerceOrderCreated;
    queueGroupName: string = AiModelCardQueueGroupeName;
    async onMessage(processedMessage: EcommerceOrderCreatedEvent['data'] , msg: Message){

        const card = await EcommerceModel.findById(processedMessage.aiModelCard.cardRefId);
        if(!card){
            console.log(processedMessage.aiModelCard)
            throw new NotFoundError();
        }
        card.set({orderId:processedMessage.id});
        await card.save()
        await new EcommerceUpdatePublisher(this.client).publish({
            id: card.id,
            rank: card.rank,
            modelId: card.modelId,
            price: card.price,
            userId: card.userId,
            orderId: card.orderId,
            version: card.version
        })

        msg.ack();

}
}

class OrderCancelledListener extends BaseListener<EcommerceOrderCancelledEvent>{

        readonly subject: Subjects.EcommerceOrderCancelled=  Subjects.EcommerceOrderCancelled;
    queueGroupName: string = AiModelCardQueueGroupeName;
    async onMessage(processedMessage: EcommerceOrderCancelledEvent['data'] , msg: Message){
        const card = await EcommerceModel.findById(processedMessage.aiModelCard.cardRefId);
        if(!card){
            console.log('card not found!!!')
            throw new NotFoundError();
        }

        if(!card.orderId || card.orderId !== processedMessage.id){
            console.log(card.orderId, processedMessage.id)
            throw new BadRequestError('invalid order cancel!')
        }

        card.set({orderId:undefined});
        await card.save()
        await new EcommerceUpdatePublisher(this.client).publish({
            id: card.id,
            rank: card.rank,
            modelId: card.modelId,
            price: card.price,
            userId: card.userId,
            orderId: undefined,
            version: card.version
        })

        msg.ack();

}
}

class EcommerceOrderExpiredListener extends BaseListener<EcommerceOrderExpiredEvent>{
    readonly subject: Subjects.EcommerceOrderExpired = Subjects.EcommerceOrderExpired;
    queueGroupName: string = AiModelCardQueueGroupeName;
    async onMessage(processedMessage: { id: string; }, msg: Message) {
        // change the card orderId to undefiended
        const card = await EcommerceModel.find({orderId: processedMessage.id});
        if(!card || card.length!==1){
            console.log('card not found!!!')
            throw new NotFoundError();
        }
        const targetCard = card[0]
        if(!targetCard.orderId || targetCard.orderId !== processedMessage.id){
            console.log(targetCard.orderId, processedMessage.id)
            throw new BadRequestError('invalid order cancel!')
        }

        targetCard.set({orderId:undefined});
        await targetCard.save()
        await new EcommerceUpdatePublisher(this.client).publish({
            id: targetCard.id,
            rank: targetCard.rank,
            modelId: targetCard.modelId,
            price: targetCard.price,
            userId: targetCard.userId,
            orderId: undefined,
            version: targetCard.version
        })


        msg.ack()

    }
}

export {OrderCancelledListener, OrderCreatedListener, EcommerceOrderExpiredListener}