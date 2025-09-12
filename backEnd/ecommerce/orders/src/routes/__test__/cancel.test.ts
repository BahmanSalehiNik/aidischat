import request from "supertest";
import { app } from "../../app";
import { OrderStatus } from "../../models/order";
import { AiModelCard } from "../../models/aiModelCard";
import { natsClient } from "../../nats-client";
import { Types } from "mongoose";

it('test succeeds canceling an order', async()=>{
    const user1 = global.signin('id1', 'user1@test.com');
    const card = AiModelCard.add({
        cardRefId: new Types.ObjectId().toHexString(),
        modelRefId: 'model1',
        price: 111,
        userId: 'id1'
    });

    card.save()

    const orderReq = await request(app)
    .post('/api/ecommerce/orders')
    .set('Cookie',user1)
    .send({aiModelCardId:card.cardRefId})

    expect(orderReq.status).toEqual(201);
    expect(await card.isAvailable()).toEqual(false);
    
    // Canceling the order
    const updatedOrderReq = await request(app)
    .patch('/api/ecommerce/orders')
    .set('Cookie', user1)
    .send({
        orderId: orderReq.body.id,
        status: OrderStatus.Cancelled
    })

    expect(updatedOrderReq.status).toEqual(200);
    expect(updatedOrderReq.body.order.status).toEqual(OrderStatus.Cancelled);
    expect(await card.isAvailable()).toEqual(true);
    expect(natsClient.client.publish).toHaveBeenCalled();


})

it('tests cancelling another users order fails', async()=>{

    const user1 = global.signin('id1', 'user1@test.com');
    const user2 = global.signin('id2', 'user2@test.com');

    const card = AiModelCard.add({
        cardRefId: new Types.ObjectId().toHexString(),
        modelRefId: 'model1',
        price: 111,
        userId: 'id1'
    });

    await card.save()

    const orderReq = await request(app)
    .post('/api/ecommerce/orders')
    .set('Cookie',user1)
    .send({aiModelCardId:card.cardRefId})

    expect(orderReq.status).toEqual(201);
    expect(await card.isAvailable()).toEqual(false);
    
    // user2 tries canceling the order created by 
    const updatedOrderReq = await request(app)
    .patch('/api/ecommerce/orders')
    .set('Cookie', user2)
    .send({
        orderId: orderReq.body.id,
        status: OrderStatus.Cancelled
    })

    // Order should not be cancelled and the card still not available

    expect(updatedOrderReq.status).toEqual(401);
    // useing the none updated order as there is no updated order returned.
    expect(orderReq.body.status).not.toEqual(OrderStatus.Cancelled);
    expect(await card.isAvailable()).toEqual(false);

})

it.todo('tests event published for cancelling and event')