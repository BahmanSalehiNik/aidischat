import { app } from "./app";
import express from "express";
import mongoose from "mongoose";
import { kafkaWrapper } from './kafka-client';
import { startDisconnectListener } from './disconnect-listener';
import { UserCreatedListener } from './events/listeners/user-created-listener';
import { ProfileCreatedListener } from './events/listeners/profile-created-listener';
import { ProfileUpdatedListener } from './events/listeners/profile-updated-listener';



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

        // Start event listeners for user/profile data
        console.log("Starting Kafka listeners for user/profile data...");
        new UserCreatedListener(kafkaWrapper.consumer('room-service-user-created')).listen().catch(err => {
            console.error("❌ Failed to start UserCreatedListener:", err);
        });
        new ProfileCreatedListener(kafkaWrapper.consumer('room-service-profile-created')).listen().catch(err => {
            console.error("❌ Failed to start ProfileCreatedListener:", err);
        });
        new ProfileUpdatedListener(kafkaWrapper.consumer('room-service-profile-updated')).listen().catch(err => {
            console.error("❌ Failed to start ProfileUpdatedListener:", err);
        });

        // Start disconnect listener to handle user disconnection cleanup
        await startDisconnectListener();
        console.log("Disconnect listener started");

        app.listen(3000, ()=>{
            console.log("app listening on port 3000! room service")
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