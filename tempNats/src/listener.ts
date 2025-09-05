import nats, { Message } from 'node-nats-streaming';
import { randomBytes } from 'crypto';


console.clear();


const client = nats.connect('ecommerce-models', randomBytes(4).toString('hex'), {
    url: 'http://localhost:4222'
});



client.on('connect', ()=>{
    client.on('close', ()=>{
        console.log('Listener NATS connection closed!')
        process.exit()
    });
    console.log('Listener connected to NATS');
    const options = client
        .subscriptionOptions()
        .setManualAckMode(true)
        .setDeliverAllAvailable()
        .setDurableName('ecommerce-mode-service')

    const subscription = client.subscribe('ecommerce-model:created',
        'ecommerce-models-queue-group',
         options);
    subscription.on('message',(msg: Message)=>{
        if (typeof msg.getData() === 'string'){
            console.log(`ecommerce modle created event recieved! ${msg.getData()}-sequence:${msg.getSequence()}`)
            
        }

        msg.ack();
        
    });  
    
});

process.on('SIGINT', ()=>client.close());
process.on('SIGTERM', ()=> client.close());