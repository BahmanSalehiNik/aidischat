import nats, {Stan} from 'node-nats-streaming';
import { resolve } from 'path';

class NatsClient {
    private _client?: Stan;
    get client(){
        if(!this._client){
            throw new Error('NATS client not defined..')
        }
        return this._client;
    }
    connect(clusterId: string, clientId: string, url: string): Promise<void>{
        console.log(clientId, clientId, url, "secret client")
        this._client = nats.connect(clusterId, clientId, {url});
        

        return new Promise<void>((resolve, reject)=>{

    
        this.client.on('connect', ()=>{
            console.log('client connected to NATS..');
            resolve();
        });
        this.client.on('error', (error)=>{
            reject(error)
        })
    })
    }
}

export const natsClient = new NatsClient();