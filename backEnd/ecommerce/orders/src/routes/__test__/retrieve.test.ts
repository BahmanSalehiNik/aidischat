import request from 'supertest';
import { app } from '../../app';
import { Order } from '../../models/order';
import { AiModelCard } from '../../models/aiModelCard';


it('tests retrieves all orders of a user', async()=>{
    const getOredersReq = await request(app)
    .get('/api/ecommerce/orders')
    .set('Cookie', global.signin())
    .send();
    expect(getOredersReq.statusCode).toEqual(200);
    expect(getOredersReq.body['orders'].length).toEqual(0);


    // card added for another user!
    const card = AiModelCard.add({
            userId:'someuser',
            cardRefId:'fakeCardRed',
            price:234,
            modelRefId: 'someFakemodelId'
        })
        await card.save()
    // The signin user still should not have any orders
    // creating an order for signin user
    await request(app)
    .post('/api/ecommerce/orders')
    .set('Cookie', global.signin())
    .send({aiModelCardId:card.id})
    .expect(201);
    
        const getOredersReq2 = await request(app)
    .get('/api/ecommerce/orders')
    .set('Cookie', global.signin())
    .send();
    expect(getOredersReq2.statusCode).toEqual(200);
    expect(getOredersReq2.body['orders'].length).toEqual(1);

}
)

it('test user cannat see another users orders!', async()=>{

        const card = AiModelCard.add({
            userId:'someuser',
            cardRefId:'fakeCardRed',
            price:111,
            modelRefId: 'someFakemodelId'
        })
        await card.save()

       await request(app)
    .post('/api/ecommerce/orders')
    .set('Cookie', global.signin())
    .send({aiModelCardId:card.id})
    .expect(201);
    
        const getOredersReq2 = await request(app)
    .get('/api/ecommerce/orders')
    .set('Cookie', global.signin())
    .send();
    expect(getOredersReq2.statusCode).toEqual(200);
    expect(getOredersReq2.body['orders'].length).toEqual(1);
    expect(getOredersReq2.body['orders'][0].aiModelCard.price).toEqual(111)

        // creating another card and assigning it to another user
            const anotherCard = AiModelCard.add({
            userId:'someuser2',
            cardRefId:'fakeCardRed2',
            price:222,
            modelRefId: 'someFakemodelId'
        })
        await anotherCard.save()


       await request(app)
    .post('/api/ecommerce/orders')
    .set('Cookie', global.signin('anotherUser','anotherUser@ai.com'))
    .send({aiModelCardId:anotherCard.id})
    .expect(201);
    
    // The first user stll only sees his own cards
    const getOredersReq3 = await request(app)
    .get('/api/ecommerce/orders')
    .set('Cookie', global.signin())
    .send();
    expect(getOredersReq3.statusCode).toEqual(200);
    expect(getOredersReq3.body['orders'].length).toEqual(1);
    expect(getOredersReq3.body['orders'][0].aiModelCard.price).toEqual(111)
    
    // Total number of orders are 2
    const allOrders = await Order.find({})
    expect(allOrders.length).toEqual(2)


})