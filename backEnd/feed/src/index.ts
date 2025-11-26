
import express from "express";
import mongoose from "mongoose";
import { app } from "./app";
import { kafkaWrapper } from './kafka-client';
import { UserCreatedListener, UserUpdatedListener, UserDeletedListener } from "./events/listeners/user/userListener";
import { ProfileCreatedListener, ProfileUpdatedListener, ProfileDeletedListener } from "./events/listeners/user/profileListener";
import { PostCreatedListener, PostUpdatedListener, PostDeletedListener } from "./events/listeners/post/postListener";
import { CommentCreatedListener, CommentDeletedListener } from "./events/listeners/comment/commentListener";
import { ReactionCreatedListener, ReactionDeletedListener } from "./events/listeners/reaction/reactionListener";
import { FriendshipAcceptedListener, 
    FriendshipUpdatedListener, 
    FriendshipRequestedListener } from "./events/listeners/friendship/friendshipListener";
import { GroupIdUserCreated, GroupIdUserUpdated, GroupIdProfileCreated, GroupIdProfileUpdated, GroupIdPostCreated, GroupIdPostUpdated, GroupIdPostDeleted, GroupIdCommentCreated, GroupIdCommentDeleted, GroupIdReactionCreated, GroupIdReactionDeleted, GroupIdFreindshipAccepted, GroupIdFreindshipRequested, GroupIdFreindshipUpdated } from "./events/queGroupNames";
import { trendingWorker } from "./modules/trending/trendingWorker";


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
    
    // Azure Storage credentials are optional - feed service can work without them
    // but signed URL generation for media will be disabled if not provided
    if (process.env.AZURE_STORAGE_ACCOUNT && process.env.AZURE_STORAGE_KEY) {
        console.log("Azure Storage credentials found - signed URL generation enabled");
    } else {
        console.log("Azure Storage credentials not found - signed URL generation disabled");
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
        // Each listener uses its own consumer group to avoid partition assignment conflicts
        // User listeners - each with separate consumer group
        new UserCreatedListener(kafkaWrapper.consumer(GroupIdUserCreated)).listen();
        new UserUpdatedListener(kafkaWrapper.consumer(GroupIdUserUpdated)).listen();
        new UserDeletedListener(kafkaWrapper.consumer("feed-user-deleted")).listen();

        // Profile listeners - each with separate consumer group
        new ProfileCreatedListener(kafkaWrapper.consumer(GroupIdProfileCreated)).listen();
        new ProfileUpdatedListener(kafkaWrapper.consumer(GroupIdProfileUpdated)).listen();
        new ProfileDeletedListener(kafkaWrapper.consumer("feed-profile-deleted")).listen();

        // Post listeners - each with separate consumer group
        new PostCreatedListener(kafkaWrapper.consumer(GroupIdPostCreated)).listen();
        new PostUpdatedListener(kafkaWrapper.consumer(GroupIdPostUpdated)).listen();
        new PostDeletedListener(kafkaWrapper.consumer(GroupIdPostDeleted)).listen();

        // Comment listeners - each with separate consumer group
        new CommentCreatedListener(kafkaWrapper.consumer(GroupIdCommentCreated)).listen();
        new CommentDeletedListener(kafkaWrapper.consumer(GroupIdCommentDeleted)).listen();

        // Reaction listeners - each with separate consumer group
        new ReactionCreatedListener(kafkaWrapper.consumer(GroupIdReactionCreated)).listen();
        new ReactionDeletedListener(kafkaWrapper.consumer(GroupIdReactionDeleted)).listen();

        // Friendship listeners - each with separate consumer group
        new FriendshipRequestedListener(kafkaWrapper.consumer(GroupIdFreindshipRequested)).listen();
        new FriendshipAcceptedListener(kafkaWrapper.consumer(GroupIdFreindshipAccepted)).listen();
        new FriendshipUpdatedListener(kafkaWrapper.consumer(GroupIdFreindshipUpdated)).listen();

        console.log("All Kafka listeners started successfully");

        trendingWorker.start();

        app.listen(3000, ()=>{
            console.log("app listening on port 3000! feed service")
        });
        
    } catch(err) {
        console.error("Error starting service:", err);
        process.exit(1);
    }
}

startMongoose()