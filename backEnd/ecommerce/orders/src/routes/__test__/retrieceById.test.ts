import request from 'supertest';
import { app } from '../../app';
import { Order } from '../../models/order';
import { AiModelCard } from '../../models/aiModelCard';
import { Types } from 'mongoose';


it('test returns order of the user', async ()=>{
    const user1 = global.signin('id1', 'user1@test.com')
    const user2 = global.signin('id2', 'user2@test.com') 
    

    // creating two cards and one order for each created by user1 and user2
    const aiCard1 = AiModelCard.add({
        cardRefId: new Types.ObjectId().toHexString(),
        modelRefId: 'modleRef1',
        price: 111,
        userId: user1.toString()
    })

    await aiCard1.save();

    const aiCard2 = AiModelCard.add({
        cardRefId: new Types.ObjectId().toHexString(),
        modelRefId: 'modleRef2',
        price: 222,
        userId: user2.toString()
    })


    await aiCard2.save();

        const tempCard = await AiModelCard.find({});
    console.log(tempCard, 'secret card!')

    const order1Req = await request(app)
    .post('/api/ecommerce/orders')
    .set('Cookie', user1)
    .send({
        aiModelCardId: aiCard1.cardRefId
    })
    
    expect(order1Req.status).toEqual(201)


    const order2Req = await request(app)
    .post('/api/ecommerce/orders')
    .set('Cookie', user2)
    .send({
        aiModelCardId: aiCard2.cardRefId
    })
    
    expect(order2Req.status).toEqual(201)

    // testing each user can query his own order

    const user1OrderReq = await request(app)
    .get(`/api/ecommerce/orders/${order1Req.body.id}`)
    .set('Cookie', user1)

    expect(user1OrderReq.status).toEqual(200)
    expect(user1OrderReq.body.userId).toEqual('id1')

    const user2OrderReq = await request(app)
    .get(`/api/ecommerce/orders/${order2Req.body.id}`)
    .set('Cookie', user2)

    expect(user2OrderReq.status).toEqual(200)
    expect(user2OrderReq.body.userId).toEqual('id2')

    //test user1 can not access order2

    const user1Order2Req = await request(app)
    .get(`/api/ecommerce/orders/${order2Req.body.id}`)
    .set('Cookie', user1)

    expect(user1Order2Req.status).toEqual(401)

    
}
)

it.todo('make the above test two separate tests.')