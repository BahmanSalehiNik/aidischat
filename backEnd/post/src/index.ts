
import express from "express";
import mongoose from "mongoose";
import { app } from "./app";
import { natsClient } from "./nats-client";
import { UserCreatedListener, UserUpdatedListener } from "./events/listeners/user/userListener";
import { KafkaUserCreatedListener, KafkaUserUpdatedListener } from "./events/listeners/user/userListener";
import { KafkaProfileCreatedListener } from "./events/listeners/user/profileListener";
import { FreindshipAcceptedListener, FreindshipRequestedListener, FreindshipUpdatedListener} from "./events/listeners/friendship/friendshipListener";
import { ProfileCreatedListener } from "./events/listeners/user/profileListener";
import { Kafka } from 'kafkajs';
import { PostQueueGroupeName, GroupIdProfileCreated, GroupIdUserCreated, GroupIdUserUpdated } from "./events/queGroupNames";


const startMongoose = async ()=>{
    if(!process.env.JWT_DEV){
        throw new Error("JWT_DEV must be defined!")
    }
        if(!process.env.MONGO_URI){
        throw new Error("MONGO_URI must be defined!")
    }
        if(!process.env.NATS_URL){
        throw new Error("NATS_URL must be defined!")
    }
        if(!process.env.NATS_CLUSTER_ID){
        throw new Error("NATS_CLUSTER_ID must be defined!")
    }
        if(!process.env.NATS_CLIENT_ID){
        throw new Error("NATS_CLIENT_ID must be defined!")
    }
        if(!process.env.KAFKA_CLIENT_ID){
        throw new Error("KAFKA_CLIENT_ID must be defined!")
    }
        if(!process.env.KAFKA_BROKER_URL){
        throw new Error("KAFKA_BROKER_URL must be defined!")
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
      
    // ------------- user listeners ------------
    new UserCreatedListener(natsClient.client).listen();
    new UserUpdatedListener(natsClient.client).listen();

        // ------------- profile listeners ------------
    new ProfileCreatedListener(natsClient.client).listen()
    
    //---------- friendship listeners ---------
    new FreindshipAcceptedListener(natsClient.client).listen();
    new FreindshipRequestedListener(natsClient.client).listen();
    new FreindshipUpdatedListener(natsClient.client).listen();


      // ------------- Kafka ------------

//     const kafka = new Kafka({
//     clientId: process.env.KAFKA_CLIENT_ID,
//     brokers: (process.env.KAFKA_BROKER_URL || 'http://redpanda-srv:9092').split(','),
//   });

    console.log("Connecting to Kafka at:", process.env.KAFKA_BROKER_URL);
    const brokers = process.env.KAFKA_BROKER_URL
    ? process.env.KAFKA_BROKER_URL.split(',').map(host => host.trim())
    : [];

    if (!brokers.length) {
    throw new Error('❌ KAFKA_BROKERS is not defined or is empty.');
    }

    console.log(process.env.KAFKA_BROKER_URL)

    const kafka = new Kafka({
    clientId: process.env.KAFKA_CLIENT_ID || 'post-service',
    brokers,
    });
    new KafkaUserCreatedListener(kafka.consumer({groupId: GroupIdUserCreated})).listen();
    new KafkaUserUpdatedListener(kafka.consumer({groupId: GroupIdUserUpdated})).listen();
    new KafkaProfileCreatedListener(kafka.consumer({groupId: GroupIdProfileCreated})).listen();

      // ------------ Mongoose ----------
      await mongoose.connect(process.env.MONGO_URI);
    } catch(err) {
        console.error(err);
    }
    
}

startMongoose()



app.listen(3000, ()=>{
    console.log("app listening on port 3000! friendship$")
})

app.use(function (req: express.Request, res: express.Response, next) {
    next({ status: 404 });
});

app.use(function (err: any, req: express.Request, res: express.Response, next: express.NextFunction) {
    console.error(err);
    res.status(err.status || 500).json();
});