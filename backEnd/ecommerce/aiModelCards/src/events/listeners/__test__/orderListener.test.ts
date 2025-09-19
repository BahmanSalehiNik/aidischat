import request from 'supertest';
import { Message } from 'node-nats-streaming'
import { EcommerceModel } from '../../../models/ecommerceModel';
import { Types} from 'mongoose';
import { natsClient } from '../../../nats-client';
import { OrderCreatedListener, OrderCancelledListener } from '../orderLIsteners';
import { EcommerceOrderCreatedEvent, OrderStatus, EcommerceOrderCancelledEvent } from '@aichatwar/shared';



const start = async()=>{
    const modelId = new Types.ObjectId().toHexString();
    const orderId = new Types.ObjectId().toHexString();
    // create card
    const card = EcommerceModel.add({
        modelId: modelId,
        price: 111,
        rank:11,
        userId: 'user1'//global.signin().toString() 
    })
    await card.save();
    // create a listener instance
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
            cardRefId: card.id,
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
        userId: 'user1',
        version: 0,
        aiModelCard: {
            cardRefId: card.id,
            version: 2
        }
    }



    // create fake message

    // create a fake message obj
    //@ts-ignore
    const message: Message = {
        ack: jest.fn()
    } 
    return {card,orderCancelledEventData, orderCreatedEventData, listener, message, orderCancelledListener};
}

it('orderId is filled on order created event', async ()=>{
    const { card, orderCreatedEventData, listener, message} = await start();

    // the orderid on the card is not defined
    const cardBeforeOrderEvent = await EcommerceModel.findById(orderCreatedEventData.aiModelCard.cardRefId)

    expect(cardBeforeOrderEvent).toBeDefined();
    expect(cardBeforeOrderEvent!.orderId).toBeUndefined();

    //reciveing the event
    await listener.onMessage(orderCreatedEventData, message);

    // now the order id must be equal to the fake data id 
    const cardAfterOrder = await EcommerceModel.findById(orderCreatedEventData.aiModelCard.cardRefId)

    expect(cardAfterOrder).toBeDefined();
    expect(cardAfterOrder!.orderId).toEqual(orderCreatedEventData.id);

    expect(message.ack).toHaveBeenCalled();

})

it('publishes ai model updated event', async()=>{

    const { card, orderCancelledEventData, orderCreatedEventData, listener, message} = await start();

    // the orderid on the card is not defined
    const cardBeforeOrderEvent = await EcommerceModel.findById(orderCreatedEventData.aiModelCard.cardRefId)

    expect(cardBeforeOrderEvent).toBeDefined();
    expect(cardBeforeOrderEvent!.orderId).toBeUndefined();

    //reciveing the event
    await listener.onMessage(orderCreatedEventData, message);



    // now the order id must be equal to the fake data id 
    const cardAfterOrder = await EcommerceModel.findById(orderCreatedEventData.aiModelCard.cardRefId)

    expect(cardAfterOrder).toBeDefined();
    expect(cardAfterOrder!.orderId).toEqual(orderCreatedEventData.id);

    expect(natsClient.client.publish).toHaveBeenCalled();

    const publishedEventCardData = JSON.parse((natsClient.client.publish as jest.Mock).mock.calls[0][1])
    expect(publishedEventCardData.orderId).toEqual(orderCreatedEventData.id)
})

it('orderId is set to undefined after cancelling the order ', async()=>{
        const { card, orderCancelledEventData, orderCreatedEventData, 
            listener, message, orderCancelledListener} = await start();

    // the orderid on the card is not defined
    const cardBeforeOrderEvent = await EcommerceModel.findById(orderCreatedEventData.aiModelCard.cardRefId)

    expect(cardBeforeOrderEvent).toBeDefined();
    expect(cardBeforeOrderEvent!.orderId).toBeUndefined();

    //reciveing the event
    await listener.onMessage(orderCreatedEventData, message);

    // now the order id must be equal to the fake data id 
    const cardAfterOrder = await EcommerceModel.findById(orderCreatedEventData.aiModelCard.cardRefId)

    expect(cardAfterOrder).toBeDefined();
    expect(cardAfterOrder!.orderId).toEqual(orderCreatedEventData.id);

    expect(message.ack).toHaveBeenCalled();

    // ------------ cancelling the order -------------

    await orderCancelledListener.onMessage(orderCancelledEventData, message);


    // now the order id must be equal to the fake data id 
    const  cardAfterCancelling = await EcommerceModel.findById(orderCreatedEventData.aiModelCard.cardRefId)

    expect(cardAfterCancelling).toBeDefined();
    expect(cardAfterCancelling!.orderId).toBeUndefined();


})