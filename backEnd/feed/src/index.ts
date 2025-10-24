
import express from "express";
import mongoose from "mongoose";
import { app } from "./app";
import { kafkaWrapper } from './kafka-client';
import { UserCreatedListener, UserUpdatedListener } from "./events/listeners/user/userListener";
import { ProfileCreatedListener, ProfileUpdatedListener } from "./events/listeners/user/profileListener";
import { PostCreatedListener } from "./events/listeners/post/postListener";
import { FriendshipAcceptedListener, 
    FriendshipUpdatedListener, 
    FriendshipRequestedListener } from "./events/listeners/friendship/friendshipListener";
import { GroupIdUserCreated, GroupIdUserUpdated, GroupIdProfileCreated, GroupIdProfileUpdated, GroupIdPostCreated, GroupIdFreindshipAccepted, GroupIdFreindshipRequested, GroupIdFreindshipUpdated } from "./events/queGroupNames";


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

        // ------------- user listeners ------------
        new UserCreatedListener(kafkaWrapper.consumer(GroupIdUserCreated)).listen();
        new UserUpdatedListener(kafkaWrapper.consumer(GroupIdUserUpdated)).listen();

        // ------------- profile listeners ------------
        new ProfileCreatedListener(kafkaWrapper.consumer(GroupIdProfileCreated)).listen();
        new ProfileUpdatedListener(kafkaWrapper.consumer(GroupIdProfileUpdated)).listen();

        // ------------- post listeners ---------------
        new PostCreatedListener(kafkaWrapper.consumer(GroupIdPostCreated)).listen();

        // --------------- friendship listeners ------------
        new FriendshipRequestedListener(kafkaWrapper.consumer(GroupIdFreindshipRequested)).listen();
        new FriendshipAcceptedListener(kafkaWrapper.consumer(GroupIdFreindshipAccepted)).listen();
        new FriendshipUpdatedListener(kafkaWrapper.consumer(GroupIdFreindshipUpdated)).listen();

        console.log("All Kafka listeners started successfully");

        app.listen(3000, ()=>{
            console.log("app listening on port 3000! feed service")
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