import nats,{ Message, Stan } from 'node-nats-streaming';
import { BaseEvent } from './events';
import { randomBytes } from 'crypto';



abstract class BasePublisher<T extends BaseEvent>{
    
    abstract subject: T['subject'];
    private client;
    
    constructor(client: Stan){
        console.clear();
        this.client = client
    }

    publish(data: T['data']): Promise<void> {
        return new Promise<void>((resolve, reject)=>{
            this.client.publish(this.subject, JSON.stringify(data), (err) => {
            if(err){
                return reject(err);
            }
            console.log(`Event published: ${JSON.stringify(data)}, subject: ${this.subject}`)
            resolve();

        })

        })
        
    }


    

}





export { BasePublisher }
