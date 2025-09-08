import request from "supertest";
import { app } from "../../app";
import { Order, OrderStatus } from "../../models/order";
import { AiModelCard } from "../../models/aiModelCard";


it('test succeeds canceling an order', async()=>{
    const user1 = global.signin('id1', 'user1@test.com');
    const card = AiModelCard.add({
        cardRefId: 'card1',
        modelRefId: 'model1',
        price: 111,
        userId: 'id1'
    });

    card.save()

    const orderReq = await request(app)
    .post('/api/ecommerce/orders')
    .set('Cookie',user1)
    .send({aiModelCardId:card.id})

    expect(orderReq.status).toEqual(201);
    expect(await card.isAvailable()).toEqual(false);
    
    // Canceling the order
    const updatedOrderReq = await request(app)
    .put('/api/ecommerce/orders')
    .set('Cookie', user1)
    .send({
        orderId: orderReq.body.id,
        status: OrderStatus.Cancelled
    })

    expect(updatedOrderReq.status).toEqual(200);
    expect(updatedOrderReq.body.order.status).toEqual(OrderStatus.Cancelled);
    expect(await card.isAvailable()).toEqual(true);


})

it('tests cancelling another users order fails', async()=>{

    const user1 = global.signin('id1', 'user1@test.com');
    const user2 = global.signin('id2', 'user2@test.com');

    const card = AiModelCard.add({
        cardRefId: 'card1',
        modelRefId: 'model1',
        price: 111,
        userId: 'id1'
    });

    card.save()

    const orderReq = await request(app)
    .post('/api/ecommerce/orders')
    .set('Cookie',user1)
    .send({aiModelCardId:card.id})

    expect(orderReq.status).toEqual(201);
    expect(await card.isAvailable()).toEqual(false);
    
    // user2 tries canceling the order created by 
    const updatedOrderReq = await request(app)
    .put('/api/ecommerce/orders')
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