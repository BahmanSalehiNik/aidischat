import express from "express";
import mongoose from "mongoose";
import { Kafka } from "kafkajs";
import { app } from "./app";
import { kafkaWrapper } from './kafka-client';
import { UserCreatedListener, UserUpdatedListener } from './events/listeners/userListeners';
import { ProfileCreatedListener, ProfileUpdatedListener } from './events/listeners/profileListeners';
import { GroupIdUserCreated, GroupIdUserUpdated, GroupIdProfileCreated, GroupIdProfileUpdated } from './events/queGroupNames';


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
    if(!process.env.AZURE_STORAGE_ACCOUNT){
        throw new Error("AZURE_STORAGE_ACCOUNT must be defined!")
    }
    if(!process.env.AZURE_STORAGE_KEY){
        throw new Error("AZURE_STORAGE_KEY must be defined!")
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

        // ------------- user listeners ------------
        new UserCreatedListener(kafkaWrapper.consumer(GroupIdUserCreated)).listen();
        new UserUpdatedListener(kafkaWrapper.consumer(GroupIdUserUpdated)).listen();

        // ------------- profile listeners ------------
        new ProfileCreatedListener(kafkaWrapper.consumer(GroupIdProfileCreated)).listen();
        new ProfileUpdatedListener(kafkaWrapper.consumer(GroupIdProfileUpdated)).listen();

        console.log("All Kafka listeners started successfully");

        app.listen(3000, ()=>{
            console.log("app listening on port 3000! media service")
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