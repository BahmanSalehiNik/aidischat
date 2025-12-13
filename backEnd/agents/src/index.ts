import { app } from "./app";
import express from "express";
import mongoose from "mongoose";
import { kafkaWrapper } from './kafka-client';
import { UserCreatedListener, UserUpdatedListener, UserDeletedListener } from './events/listeners/userListeners';
import {
    GroupIdUserCreated,
    GroupIdUserUpdated,
    GroupIdUserDeleted,
    GroupIdAgentCreationReplySuccess,
    GroupIdAgentCreationReplyFailed
} from './events/listeners/queGroupNames';
import { AgentCreationReplySuccessListener, AgentCreationReplyFailedListener } from './events/listeners/agentProvisionListeners';
import { eventRetryWorker } from './workers/event-retry-worker';



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

        // Start event listeners
        new UserCreatedListener(kafkaWrapper.consumer(GroupIdUserCreated)).listen();
        new UserUpdatedListener(kafkaWrapper.consumer(GroupIdUserUpdated)).listen();
        new UserDeletedListener(kafkaWrapper.consumer(GroupIdUserDeleted)).listen();
        new AgentCreationReplySuccessListener(kafkaWrapper.consumer(GroupIdAgentCreationReplySuccess)).listen();
        new AgentCreationReplyFailedListener(kafkaWrapper.consumer(GroupIdAgentCreationReplyFailed)).listen();

        // Start background worker to retry publishing events for agents created during Kafka outages
        eventRetryWorker.start();

        app.listen(3000, '0.0.0.0', ()=>{
            console.log("app listening on port 3000! agents service")
        });
        
    } catch(err) {
        console.error("Error starting service:", err);
        process.exit(1);
    }
}

startMongoose()