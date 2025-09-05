import { BasePublisher } from "./events/basePublisher";
import { EcommerceModelCreatedEvent } from "./events/events";
import { Subjects } from "./events/subjects";
import nats from 'node-nats-streaming';
import { randomBytes } from "crypto";


class EcommercePublisher extends BasePublisher<EcommerceModelCreatedEvent>{
    subject: Subjects.EcommerceModelCreated = Subjects.EcommerceModelCreated;

}


const dummyEvent = {        
        id:'ecommereceModelId',
        modelId:'someModelId',
        price:40,
        rank:234,
        userId:'userIdforTest'
    }

const client = nats.connect('ecommerce-models', randomBytes(4).toString('hex'), {url:'http://localhost:4222'});


client.on('connect', ()=>{
        client.on('close',()=>{
        console.log('Listener NATS connection closed!')
        process.exit()
    })
    const listener = new EcommercePublisher(client).publish(dummyEvent);
    }
);

process.on('SIGINT', ()=>client.close());
process.on('SIGTERM', ()=> client.close());