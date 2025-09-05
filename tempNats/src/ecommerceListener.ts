import nats, { Message } from 'node-nats-streaming';
import { BaseListener } from './events/baseListener';
import { randomBytes } from 'crypto';
import { EcommerceModelCreatedEvent } from './events/events';
import { Subjects } from './events/subjects';

class EcommerceModelListener extends BaseListener<EcommerceModelCreatedEvent>{
    readonly subject: Subjects.EcommerceModelCreated = Subjects.EcommerceModelCreated;
    queueGroupName: string =  'ecommerce-models-queue-group';
    onMessage(processedMessage: EcommerceModelCreatedEvent['data'], msg: Message): void {
        console.log(`ecommerce-created-event recieved ${processedMessage}, ${msg.getSequence()}`);
        // console.log(processedMessage);
        msg.ack()
    }
}


const client = nats.connect('ecommerce-models', randomBytes(4).toString('hex'), {url:'http://localhost:4222'});

client.on('connect',()=>{
    client.on('close',()=>{
        console.log('Listener NATS connection closed!')
        process.exit()
    })
    const listener = new EcommerceModelListener(client).listen();
    }
)


process.on('SIGINT', ()=>client.close());
process.on('SIGTERM', ()=> client.close());