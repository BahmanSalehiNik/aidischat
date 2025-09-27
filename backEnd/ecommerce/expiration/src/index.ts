
import { natsClient } from "./nats-client";
import { OrderCreatedListener } from "./listeners/orderLIsteners";



const start = async ()=>{
        if(!process.env.NATS_URL){
        throw new Error("NATS_URL must be defined!")
    }
        if(!process.env.NATS_CLUSTER_ID){
        throw new Error("NATS_CLUSTER_ID must be defined!")
    }
        if(!process.env.NATS_CLIENT_ID){
        throw new Error("NATS_CLIENT_ID must be defined!")
    }
    try{
      // ------------ Nats ------------
      await natsClient.connect(process.env.NATS_CLUSTER_ID,process.env.NATS_CLIENT_ID,process.env.NATS_URL);
        natsClient.client.on('close',()=>{
        console.log('NATS connection closed!')
        process.exit()
    })
    
    process.on('SIGINT', ()=>natsClient.client.close());
    process.on('SIGTERM', ()=> natsClient.client.close());
      

    // --------------------------------------------------

    new OrderCreatedListener(natsClient.client).listen();

    } catch(err) {
        console.error(err);
    }
    
}

start();


