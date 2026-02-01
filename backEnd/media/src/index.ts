import express from "express";
import mongoose from "mongoose";
import { Kafka } from "kafkajs";
import { app } from "./app";
import { kafkaWrapper } from './kafka-client';
import { UserCreatedListener, UserUpdatedListener } from './events/listeners/userListeners';
import { ProfileCreatedListener, ProfileUpdatedListener } from './events/listeners/profileListeners';
import { GroupIdUserCreated, GroupIdUserUpdated, GroupIdProfileCreated, GroupIdProfileUpdated } from './events/queGroupNames';
import { retryWithBackoff } from './utils/connection-retry';


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
        await retryWithBackoff(
            async () => {
                await mongoose.connect(process.env.MONGO_URI!);
                console.log("Connected to MongoDB");
            },
            { maxRetries: 30, initialDelayMs: 2000 },
            "MongoDB"
        );

        // ------------ Kafka ------------
        console.log("Connecting to Kafka at:", process.env.KAFKA_BROKER_URL);
        const brokers = process.env.KAFKA_BROKER_URL
            ? process.env.KAFKA_BROKER_URL.split(',').map(host => host.trim())
            : [];

        if (!brokers.length) {
            throw new Error('❌ KAFKA_BROKERS is not defined or is empty.');
        }

        await retryWithBackoff(
            async () => {
                await kafkaWrapper.connect(brokers, process.env.KAFKA_CLIENT_ID!);
                console.log("Kafka connected successfully");
            },
            { maxRetries: 30, initialDelayMs: 2000 },
            "Kafka"
        );

        // ------------- user listeners ------------
        new UserCreatedListener(kafkaWrapper.consumer(GroupIdUserCreated)).listen();
        new UserUpdatedListener(kafkaWrapper.consumer(GroupIdUserUpdated)).listen();

        // ------------- profile listeners ------------
        new ProfileCreatedListener(kafkaWrapper.consumer(GroupIdProfileCreated)).listen();
        new ProfileUpdatedListener(kafkaWrapper.consumer(GroupIdProfileUpdated)).listen();

        console.log("All Kafka listeners started successfully");

        process.on("SIGINT", async () => {
            console.log("SIGINT received - closing Media service connections");
            await kafkaWrapper.disconnect();
            await mongoose.disconnect();
            process.exit();
        });

        process.on("SIGTERM", async () => {
            console.log("SIGTERM received - closing Media service connections");
            await kafkaWrapper.disconnect();
            await mongoose.disconnect();
            process.exit();
        });

        app.listen(3000, '0.0.0.0', ()=>{
            console.log("app listening on port 3000! media service")
        });
        
    } catch(err) {
        console.error("Error starting service:", err);
        process.exit(1);
    }
}

startMongoose();