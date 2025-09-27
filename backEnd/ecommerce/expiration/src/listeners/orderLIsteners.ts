import { BadRequestError, BaseListener, EcommerceOrderCancelledEvent,EcommerceOrderCreatedEvent,NotFoundError, Subjects } from "@aichatwar/shared";
import { ExpirationQueueGroupeName } from "./queGroupNames";
import { Message } from "node-nats-streaming";
import { xQueue } from "../queues/expirationQueue";

class OrderCreatedListener extends BaseListener<EcommerceOrderCreatedEvent>{
    readonly subject: Subjects.EcommerceOrderCreated =  Subjects.EcommerceOrderCreated;
    queueGroupName: string = ExpirationQueueGroupeName;
    async onMessage(processedMessage: EcommerceOrderCreatedEvent['data'] , msg: Message){
        const expirationDelay = new Date(processedMessage.expirationDate).getTime() - (new Date().getTime())
        console.log('listener secret start --', new Date());
        console.log(`waitig for ${expirationDelay} to expire`)
        await xQueue.add({id: processedMessage.id}, {delay:expirationDelay});
        msg.ack();
}
}

class OrderCancelledListener extends BaseListener<EcommerceOrderCancelledEvent>{

        readonly subject: Subjects.EcommerceOrderCancelled=  Subjects.EcommerceOrderCancelled;
    queueGroupName: string = ExpirationQueueGroupeName;
    async onMessage(processedMessage: EcommerceOrderCancelledEvent['data'] , msg: Message){

        msg.ack();

}
}

export {OrderCancelledListener, OrderCreatedListener}