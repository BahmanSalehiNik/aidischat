import { app } from "./app";
import express from "express";
import mongoose from "mongoose";
import { kafkaWrapper } from './kafka-client';
import { MessageIngestListener } from './events/listeners/message-ingest-listener';
import { MessageReactionIngestedListener } from './events/listeners/message-reaction-ingested-listener';
import { MessageReplyIngestedListener } from './events/listeners/message-reply-ingested-listener';
import { AiMessageReplyListener } from './events/listeners/ai-message-reply-listener';
import { RoomCreatedListener } from './events/listeners/room-created-listener';
import { RoomDeletedListener } from './events/listeners/room-deleted-listener';
import { RoomParticipantAddedListener } from './events/listeners/room-participant-added-listener';
import { AgentUpdatedListener } from './events/listeners/agent-updated-listener';
import { AgentCreatedListener } from './events/listeners/agent-created-listener';
import { AgentIngestedListener } from './events/listeners/agent-ingested-listener';
import { UserUpdatedListener } from './events/listeners/user-updated-listener';
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

        // ------------- Event Listeners ------------
        // Each listener uses its own consumer group to avoid partition assignment conflicts
        console.log("Starting Kafka listeners...");
        
        // Message ingest listener (uses dedicated consumer group)
        console.log("Starting MessageIngestListener...");
        new MessageIngestListener(kafkaWrapper.consumer('chat-service-message-ingest')).listen().catch(err => {
            console.error("❌ Failed to start MessageIngestListener:", err);
        });

        // Message reaction and reply listeners
        console.log("Starting MessageReactionIngestedListener...");
        new MessageReactionIngestedListener(kafkaWrapper.consumer('chat-service-message-reaction-ingested')).listen().catch(err => {
            console.error("❌ Failed to start MessageReactionIngestedListener:", err);
        });
        console.log("Starting MessageReplyIngestedListener...");
        new MessageReplyIngestedListener(kafkaWrapper.consumer('chat-service-message-reply-ingested')).listen().catch(err => {
            console.error("❌ Failed to start MessageReplyIngestedListener:", err);
        });

        // AI message reply listener (uses dedicated consumer group)
        console.log("Starting AiMessageReplyListener...");
        new AiMessageReplyListener(kafkaWrapper.consumer('chat-service-ai-message-reply')).listen().catch(err => {
            console.error("❌ Failed to start AiMessageReplyListener:", err);
        });

        // Room event listeners - each with separate consumer group
        console.log("Starting RoomCreatedListener...");
        new RoomCreatedListener(kafkaWrapper.consumer('chat-service-room-created')).listen().catch(err => {
            console.error("❌ Failed to start RoomCreatedListener:", err);
        });
        console.log("Starting RoomDeletedListener...");
        new RoomDeletedListener(kafkaWrapper.consumer('chat-service-room-deleted')).listen().catch(err => {
            console.error("❌ Failed to start RoomDeletedListener:", err);
        });
        // RoomParticipantAdded is idempotent - use higher maxInFlightRequests to avoid blocking
        console.log("Starting RoomParticipantAddedListener...");
        new RoomParticipantAddedListener(kafkaWrapper.consumer('chat-service-room-participant-added', 5)).listen().catch(err => {
            console.error("❌ Failed to start RoomParticipantAddedListener:", err);
        });

        // Agent and user listeners - each with separate consumer group
        console.log("Starting AgentIngestedListener...");
        new AgentIngestedListener(kafkaWrapper.consumer('chat-service-agent-ingested')).listen().catch(err => {
            console.error("❌ Failed to start AgentIngestedListener:", err);
        });
        console.log("Starting AgentCreatedListener...");
        new AgentCreatedListener(kafkaWrapper.consumer('chat-service-agent-created')).listen().catch(err => {
            console.error("❌ Failed to start AgentCreatedListener:", err);
        });
        console.log("Starting AgentUpdatedListener...");
        new AgentUpdatedListener(kafkaWrapper.consumer('chat-service-agent-updated')).listen().catch(err => {
            console.error("❌ Failed to start AgentUpdatedListener:", err);
        });
        console.log("Starting UserCreatedListener...");
        new UserCreatedListener(kafkaWrapper.consumer('chat-service-user-created')).listen().catch(err => {
            console.error("❌ Failed to start UserCreatedListener:", err);
        });
        console.log("Starting UserUpdatedListener...");
        new UserUpdatedListener(kafkaWrapper.consumer('chat-service-user-updated')).listen().catch(err => {
            console.error("❌ Failed to start UserUpdatedListener:", err);
        });
        console.log("Starting ProfileCreatedListener...");
        new ProfileCreatedListener(kafkaWrapper.consumer('chat-service-profile-created')).listen().catch(err => {
            console.error("❌ Failed to start ProfileCreatedListener:", err);
        });
        console.log("Starting ProfileUpdatedListener...");
        new ProfileUpdatedListener(kafkaWrapper.consumer('chat-service-profile-updated')).listen().catch(err => {
            console.error("❌ Failed to start ProfileUpdatedListener:", err);
        });

        console.log("✅ All Kafka listeners initialization calls completed (check logs above for connection status)");

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