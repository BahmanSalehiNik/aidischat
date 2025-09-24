import request from 'supertest';
import { Message } from 'node-nats-streaming'
import { Types} from 'mongoose';
import { natsClient } from '../../nats-client';
import { OrderCreatedListener, OrderCancelledListener } from '../orderLIsteners';
import { EcommerceOrderCreatedEvent, OrderStatus, EcommerceOrderCancelledEvent, 
    EcommerceModelUpdatedEvent } from '@aichatwar/shared';



const start = async()=>{
    const modelId = new Types.ObjectId().toHexString();
    const orderId = new Types.ObjectId().toHexString();
    const cardId = new Types.ObjectId().toHexString();
    

    const listener = new OrderCreatedListener(natsClient.client);
    // create an order cancel listener
    const orderCancelledListener = new OrderCancelledListener(natsClient.client);
    // create fake data for order created event

    
    const EXPIRATION_SECONDS= 15 * 1000
    const expiration = new Date();
    expiration.setSeconds(expiration.getSeconds()+ EXPIRATION_SECONDS)

    
    const orderCreatedEventData: EcommerceOrderCreatedEvent['data'] = {
        id: orderId,
        status: OrderStatus.WaitingPayment, 
        expirationDate: expiration.toISOString(),
        userId: global.signin().toString(),
        version: 0,
        aiModelCard:{
            cardRefId: cardId,
            id: new Types.ObjectId().toHexString(),
            modelRefId: modelId,
            price: 111,
            userId: global.signin().toString(),
            version:1
        }
    }

    // create fake cancel event data
    const orderCancelledEventData: EcommerceOrderCancelledEvent['data'] = {
        id:  orderId,
        userId: 'user1Id',
        version: 0,
        aiModelCard: {
            cardRefId: cardId,
            version: 2
        }
    }



    // create fake message

    // create a fake message obj
    //@ts-ignore
    const message: Message = {
        ack: jest.fn()
    } 
    return {orderCancelledEventData, orderCreatedEventData, 
        listener, message, orderCancelledListener};
}
