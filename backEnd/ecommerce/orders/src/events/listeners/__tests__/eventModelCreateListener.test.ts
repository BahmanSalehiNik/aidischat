import { AiModelCardCreatedListener } from "../aiModelCardListeners";
import { AiModelCard } from "../../../models/aiModelCard";
import { EcommerceModelCreatedEvent } from "@aichatwar/shared"
import { natsClient } from "../../../nats-client";
import { Types} from "mongoose";
import { Message } from "node-nats-streaming";


const start = async () =>{
    // create an instance of the listener
    const listener = new AiModelCardCreatedListener(natsClient.client);

    // create a fake data for the event
    const data: EcommerceModelCreatedEvent['data'] = {
        version: 0,
        id: new Types.ObjectId().toHexString(),
        modelId: new Types.ObjectId().toHexString(),
        price: 234,
        rank: 32,
        userId: JSON.stringify({id:new Types.ObjectId().toHexString()})
    }

    // create a fake message obj
    //@ts-ignore
    const message: Message = {
        ack: jest.fn()
    } 

    return {listener, data, message}
}

it('creates and saves an aiModelCard.', async()=>{

     const {listener, data, message} = await start();
    // call on message and pass the fake message and the processedMessage
    await listener.onMessage(data, message);
    const card = await AiModelCard.findOne({cardRefId:data.id});

    // assert aiModelCard is created
    expect(card).toBeDefined();
    expect(card!.price).toEqual(data.price);
    expect(card!.version).toEqual(data.version);

});
it('acks the message.', async()=>{
    const {listener, data, message} = await start();
    await listener.onMessage(data, message);
    const card = await AiModelCard.findOne({cardRefId:data.id});

    // assert aiModelCard is created
    expect(card).toBeDefined();
    expect(message.ack).toHaveBeenCalled()
    // call on message and pass the fake message and the processedMessage
    // assert ack function is calle
});