import mongoose from 'mongoose';
import request from 'supertest';
import { app } from '../../app';
import { AiModelCard } from '../../models/aiModelCard';
import { natsClient } from '../../nats-client';
import { Types } from 'mongoose';

//TODO: add auth related tests

it('throws exception if aimodelcard does not exist', async()=>{
    const aiModelCardId = new mongoose.Types.ObjectId();
    await request(app)
    .post('/api/ecommerce/orders')
    .set('Cookie', global.signin())
    .send({aiModelCardId})
    .expect(404);
})

it('throws exception if aimodelcard is resereved', async()=>{
    const card = new AiModelCard({
            userId:'someuser',
            cardRefId: new Types.ObjectId().toHexString(),
            price:234,
            modelRefId: 'someFakemodelId'
        })
    // creating an order for the card
    card.save()
    console.log(card.id, "secret card id")
    await request(app)
    .post('/api/ecommerce/orders')
    .set('Cookie', global.signin())
    .send({aiModelCardId:card.cardRefId})
    .expect(201);

    // now the card must be reserved 
    await request(app)
    .post('/api/ecommerce/orders')
    .set('Cookie', global.signin())
    .send({aiModelCardId:card.cardRefId})
    .expect(400);
})
    


it('successfully reserves available aimodelcard', async()=>{
        const card = new AiModelCard({
            userId:'someuser',
            cardRefId:new Types.ObjectId().toHexString(),
            price:234,
            modelRefId: 'someFakemodelId'
        })
    // creating an order for the card
    card.save()
    await request(app)
    .post('/api/ecommerce/orders')
    .set('Cookie', global.signin())
    .send({aiModelCardId:card.cardRefId})
    .expect(201);

    const queryCard = await AiModelCard.findById(card.id);
    expect(await queryCard?.isAvailable()).toEqual(false);
    expect(natsClient.client.publish).toHaveBeenCalled();
})

it.todo('publishes an order created event!')