import Queue from 'bull';
import { EcommerceExpirationPublisher } from '../publishers/orderExpiredPublisher';
import { natsClient } from '../nats-client'; 

interface ExpirationJobData {
    id: string;
}

const xQueue = new Queue<ExpirationJobData>('order:expiration',{
    redis:{
        host: process.env.REDIS_HOST

    }
})


xQueue.process(async (job) =>{
  console.log(`expiration complete event, --${new Date()}, ${job.data.id}`);
  new EcommerceExpirationPublisher(natsClient.client).publish({id: job.data.id})

  
});

export  {xQueue }