import requser from 'supertest';
import { app } from '../../../app';
import { natsClient } from '../../../nats-client';
import { AiModelCard } from '../../../models/aiModelCard';
import { Types } from 'mongoose';
import { EcommerceModelUpdatedEvent } from '@aichatwar/shared';
import { AiModelCardUpdatedListener } from '../aiModelCardListeners';


const start = async()=>{
    // creating an instance of the listener
    const listener = new AiModelCardUpdatedListener(natsClient.client);    
    
    // creating a card

    const userId = JSON.stringify({id:new Types.ObjectId().toHexString()})
    const card = AiModelCard.add({
        cardRefId: new Types.ObjectId().toHexString(),
        modelRefId: new Types.ObjectId().toHexString(),
        price: 111,
        // Todo: add test for auth: event 401 if user is not the owner of the card
        userId: userId
    })
    await card.save();
    // creating fake data for the update event to update the card
    
    const data: EcommerceModelUpdatedEvent['data'] = {
        id: card.cardRefId,
        modelId: card.modelRefId,
        price: 222,
        rank: -1,
        userId: userId,
        version: 1
    }

        // create a fake message obj
        //@ts-ignore
        const message: Message = {
            ack: jest.fn()
        } 

    return {listener, message, data}

}

it('updates ai modle card', async()=>{
    const {listener, message, data} = await start();
    await listener.onMessage(data, message);
    const card = await AiModelCard.findOne({cardRefId:data.id});  
    expect(card!).toBeDefined();
    expect(card!.price).toEqual(data.price);
    expect(card!.version).toEqual(data.version);
    expect(message.ack).toHaveBeenCalled();
})

it('event with invalid version fails', async()=>{
    const {listener, message, data} = await start();
    data.version = 2;
    console.log(data, "secret data!")
    // Expecting not found exeption in the event
    try{
    await listener.onMessage(data, message);
    }catch(err: any){
    expect(err.message).toEqual('ai model card not found!')
    }
    const tmpCard = await AiModelCard.find({})
    console.log(tmpCard, "secret card")
    const card = await AiModelCard.findOne({cardRefId:data.id});  
    expect(card!).toBeDefined();
    expect(card!.price).not.toEqual(data.price);
    expect(card!.version).not.toEqual(data.version);
    expect(message.ack).not.toHaveBeenCalled();

})