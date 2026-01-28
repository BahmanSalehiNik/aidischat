
import express from "express";
import mongoose from "mongoose";
import { app } from "./app";
import { kafkaWrapper } from './kafka-client';
import { retryWithBackoff } from './utils/connection-retry';
import { UserCreatedListener, UserUpdatedListener } from "./events/listeners/user/userListener";
import { ProfileCreatedListener, ProfileUpdatedListener } from "./events/listeners/user/profileListener";
import { FriendshipAcceptedListener, FriendshipRequestedListener, FriendshipUpdatedListener} from "./events/listeners/friendship/friendshipListener";
import { MediaCreatedListener } from "./events/listeners/media/mediaListener";
import { AgentDraftPostApprovedListener } from "./events/listeners/agentDraft/agentDraftPostApprovedListener";
import { AgentDraftCommentApprovedListener } from "./events/listeners/agentDraft/agentDraftCommentApprovedListener";
import { AgentDraftReactionApprovedListener } from "./events/listeners/agentDraft/agentDraftReactionApprovedListener";
import { GroupIdProfileCreated, GroupIdProfileUpdated, GroupIdUserCreated, GroupIdUserUpdated, GroupIdFreindshipAccepted, GroupIdFreindshipRequested, GroupIdFreindshipUpdated, GroupIdMediaCreated } from "./events/queGroupNames";


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
    
    // Azure Storage credentials are optional - post service can work without them
    // but signed URL generation for media will be disabled if not provided
    if (process.env.AZURE_STORAGE_ACCOUNT && process.env.AZURE_STORAGE_KEY) {
        console.log("Azure Storage credentials found - signed URL generation enabled");
    } else {
        console.log("Azure Storage credentials not found - signed URL generation disabled");
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

        // ------------- Kafka ------------
        console.log("Connecting to Kafka at:", process.env.KAFKA_BROKER_URL);
        const brokers = process.env.KAFKA_BROKER_URL
            ? process.env.KAFKA_BROKER_URL.split(',').map(host => host.trim())
            : [];

        if (!brokers.length) {
            throw new Error('❌ KAFKA_BROKERS is not defined or is empty.');
        }

        await retryWithBackoff(
            async () => {
                await kafkaWrapper.connect(brokers, process.env.KAFKA_CLIENT_ID);
                console.log("Kafka connected successfully");
            },
            { maxRetries: 30, initialDelayMs: 2000 },
            "Kafka"
        );

        // ------------- Event Listeners ------------
        // Each listener uses its own consumer group to avoid partition assignment conflicts
        // User listeners - each with separate consumer group
        new UserCreatedListener(kafkaWrapper.consumer(GroupIdUserCreated)).listen();
        new UserUpdatedListener(kafkaWrapper.consumer(GroupIdUserUpdated)).listen();

        // Profile listeners - each with separate consumer group
        new ProfileCreatedListener(kafkaWrapper.consumer(GroupIdProfileCreated)).listen();
        new ProfileUpdatedListener(kafkaWrapper.consumer(GroupIdProfileUpdated)).listen();
        
        // Friendship listeners - each with separate consumer group
        new FriendshipAcceptedListener(kafkaWrapper.consumer(GroupIdFreindshipAccepted)).listen();
        new FriendshipRequestedListener(kafkaWrapper.consumer(GroupIdFreindshipRequested)).listen();
        new FriendshipUpdatedListener(kafkaWrapper.consumer(GroupIdFreindshipUpdated)).listen();

        // Media listeners - each with separate consumer group
        new MediaCreatedListener(kafkaWrapper.consumer(GroupIdMediaCreated)).listen();

        // Agent Draft listeners
        new AgentDraftPostApprovedListener(kafkaWrapper.consumer('post-service-agent-draft-post-approved')).listen();
        new AgentDraftCommentApprovedListener(kafkaWrapper.consumer('post-service-agent-draft-comment-approved')).listen();
        new AgentDraftReactionApprovedListener(kafkaWrapper.consumer('post-service-agent-draft-reaction-approved')).listen();

        console.log("All Kafka listeners started successfully");

        app.listen(3000, '0.0.0.0', ()=>{
            console.log("app listening on port 3000! post service")
        });
        
    } catch(err) {
        console.error("Error starting service:", err);
        process.exit(1);
    }
}

startMongoose()