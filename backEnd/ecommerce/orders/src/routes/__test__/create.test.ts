import mongoose from 'mongoose';
import request from 'supertest';
import { app } from '../../app';
import { AiModelCard } from '../../models/aiModelCard';

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
            cardRefId:'fakeCardRed',
            price:234,
            modelRefId: 'someFakemodelId'
        })
    // creating an order for the card
    card.save()
    console.log(card.id, "secret card id")
    await request(app)
    .post('/api/ecommerce/orders')
    .set('Cookie', global.signin())
    .send({aiModelCardId:card.id})
    .expect(201);

    // now the card must be reserved 
    await request(app)
    .post('/api/ecommerce/orders')
    .set('Cookie', global.signin())
    .send({aiModelCardId:card.id})
    .expect(400);
})
    


it('reserve available aimodelcard', async()=>{
        const card = new AiModelCard({
            userId:'someuser',
            cardRefId:'fakeCardRed',
            price:234,
            modelRefId: 'someFakemodelId'
        })
    // creating an order for the card
    card.save()
    await request(app)
    .post('/api/ecommerce/orders')
    .set('Cookie', global.signin())
    .send({aiModelCardId:card.id})
    .expect(201);

    const queryCard = await AiModelCard.findById(card.id);
    expect(await queryCard?.isAvailable()).toEqual(false);
})

it.todo('publishes an order created event!')