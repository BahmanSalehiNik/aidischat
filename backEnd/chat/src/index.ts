import { app } from "./app";
import express from "express";
import mongoose from "mongoose";
import { kafkaWrapper } from './kafka-client';
import { MessageIngestListener } from './events/listeners/message-ingest-listener';
import { RoomCreatedListener } from './events/listeners/room-created-listener';
import { RoomDeletedListener } from './events/listeners/room-deleted-listener';
import { RoomParticipantAddedListener } from './events/listeners/room-participant-added-listener';
import { AgentUpdatedListener } from './events/listeners/agent-updated-listener';
import { UserUpdatedListener } from './events/listeners/user-updated-listener';



const startMongoose = async ()=>{
    if(!process.env.JWT_DEV){
        throw new Error("JWT_DEV must be defined!")
    }
    if(!process.env.MONGO_URI){
        throw new Error("MONGO_URI must be defined!")
    }
    if(!process.env.KAFKA_CLIENT_ID){
        throw new Error("KAFKA_CLIENT_ID must be defined!")
    }
    if(!process.env.KAFKA_BROKER_URL){
        throw new Error("KAFKA_BROKER_URL must be defined!")
    }
    
    try{
        // ------------ Mongoose ----------
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB");

        // ------------ Kafka ------------
        console.log("Connecting to Kafka at:", process.env.KAFKA_BROKER_URL);
        const brokers = process.env.KAFKA_BROKER_URL
            ? process.env.KAFKA_BROKER_URL.split(',').map(host => host.trim())
            : [];

        if (!brokers.length) {
            throw new Error('❌ KAFKA_BROKERS is not defined or is empty.');
        }

        await kafkaWrapper.connect(brokers, process.env.KAFKA_CLIENT_ID);
        console.log("Kafka connected successfully");

        // ------------- Event Listeners ------------
        // Message ingest listener (uses dedicated consumer group)
        new MessageIngestListener(kafkaWrapper.consumer('chat-service-message-ingest')).listen();

        // Room event listeners
        new RoomCreatedListener(kafkaWrapper.consumer('chat-service')).listen();
        new RoomDeletedListener(kafkaWrapper.consumer('chat-service')).listen();
        new RoomParticipantAddedListener(kafkaWrapper.consumer('chat-service')).listen();

        // Agent and user update listeners
        new AgentUpdatedListener(kafkaWrapper.consumer('chat-service')).listen();
        new UserUpdatedListener(kafkaWrapper.consumer('chat-service')).listen();

        console.log("All Kafka listeners started successfully");

        app.listen(3000, ()=>{
            console.log("app listening on port 3000! chat service")
        });
        
    } catch(err) {
        console.error("Error starting service:", err);
        process.exit(1);
    }
}

startMongoose()



app.use(function (req: express.Request, res: express.Response, next) {
    next({ status: 404 });
});

app.use(function (err: any, req: express.Request, res: express.Response, next: express.NextFunction) {
    console.error(err);
    res.status(err.status || 500).json();
});