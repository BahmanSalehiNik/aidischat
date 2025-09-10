import nats,{ Message, Stan } from 'node-nats-streaming';
import { BaseEvent } from './events';
import { randomBytes } from 'crypto';



abstract class BaseListener<T extends BaseEvent>{
    
    abstract subject: T['subject'];
    abstract queueGroupName: string;
    abstract onMessage(processedMessage: T['data'], msg: Message): void;


    private client;
    protected ackDeadline: number = 5 * 1000;


    
    constructor(client: Stan){
        console.clear();
        this.client = client //nats.connect(subject, randomBytes(4).toString('hex'), {url:this.url})

    }

    subscriptionOptions(){
            return this.client
            .subscriptionOptions()
            .setDeliverAllAvailable()
            .setManualAckMode(true)
            .setAckWait(this.ackDeadline)
            .setDurableName(this.queueGroupName)
    }

    listen() {

        console.log(this.subscriptionOptions())
        console.log(this.subject, this.queueGroupName,'subject')
        const subscription = this.client.subscribe(
            this.subject,
            this.queueGroupName,
         this.subscriptionOptions());

         subscription.on('message', (msg)=>{
            console.log(
                `Message recived -> subject: ${this.subject}, queue group name: ${this.queueGroupName} `);
            const processedMessage = this.processMessage(msg);
            this.onMessage(processedMessage, msg);

         })
    }
    processMessage(msg: Message){
        const msgData = msg.getData();
        return typeof msgData === 'string' ? msgData : JSON.parse(msgData.toLocaleString('utf8'))

    };

    

}





export { BaseListener }
