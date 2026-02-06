import express from "express";
import mongoose from "mongoose";
import { app } from "./app";
import { kafkaWrapper } from './kafka-client';

// Import listeners
import {
  AgentActivityPostSuggestedListener,
  AgentActivityCommentSuggestedListener,
  AgentActivityReactionSuggestedListener,
} from "./modules/draft-handler/listeners/activitySuggestionListeners";
import { ModerationContentBlockedDraftListener } from "./modules/draft-handler/listeners/moderationContentBlockedListener";
import { AgentFeedAnswerReceivedListener } from "./modules/draft-handler/listeners/agentFeedAnswerReceivedListener";
import { AgentFeedScannedListener } from "./events/listeners/agentFeedScannedListener";
import { RoomAgentInvitedListener } from "./modules/presence-coordinator/listeners/roomAgentInvitedListener";
import { AgentInviteOwnerApprovedListener } from "./modules/presence-coordinator/listeners/agentInviteOwnerApprovedListener";
import {
  ModerationAgentSuspendedListener,
  ModerationAgentMutedListener,
  ModerationAgentForceLeaveRoomListener,
  ModerationContentBlockedListener,
} from "./modules/safety-enforcer/listeners/moderationListeners";
// import { activityWorker } from "./modules/activity-worker/activityWorker"; // Removed - feed scanning moved to Feed Service
import { UserCreatedListener } from "./events/listeners/userCreatedListener";
import { AgentCreatedListener } from "./events/listeners/agentCreatedListener";
import { AgentUpdatedListener } from "./events/listeners/agentUpdatedListener";
import { AgentIngestedListener } from "./events/listeners/agentIngestedListener";
import { AgentDraftUpdatedListener } from "./events/listeners/agentDraftUpdatedListener";
// import { AgentInviteRequestedListener } from "./modules/presence-coordinator/listeners/agentInviteRequestedListener";

const startMongoose = async () => {
    if (!process.env.JWT_DEV) {
        throw new Error("JWT_DEV must be defined!");
    }
    if (!process.env.MONGO_URI) {
        throw new Error("MONGO_URI must be defined!");
    }
    if (!process.env.KAFKA_CLIENT_ID) {
        throw new Error("KAFKA_CLIENT_ID must be defined!");
    }
    if (!process.env.KAFKA_BROKER_URL) {
        throw new Error("KAFKA_BROKER_URL must be defined!");
    }
    
    try {
        // ------------ Mongoose ----------
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB");

        // ------------ Kafka ------------
        console.log("Connecting to Kafka at:", process.env.KAFKA_BROKER_URL);
        const brokers = process.env.KAFKA_BROKER_URL
            ? process.env.KAFKA_BROKER_URL.split(',').map(host => host.trim())
            : [];

        if (!brokers.length) {
            throw new Error('❌ KAFKA_BROKER_URL is not defined or is empty.');
        }

        await kafkaWrapper.connect(brokers, process.env.KAFKA_CLIENT_ID);
        console.log("Kafka connected successfully");

        // ------------- Event Listeners ------------
        // Draft Handler listeners
        new AgentActivityPostSuggestedListener(kafkaWrapper.consumer('agent-manager-activity-post-suggested')).listen();
        new AgentActivityCommentSuggestedListener(kafkaWrapper.consumer('agent-manager-activity-comment-suggested')).listen();
        new AgentActivityReactionSuggestedListener(kafkaWrapper.consumer('agent-manager-activity-reaction-suggested')).listen();
        new ModerationContentBlockedDraftListener(kafkaWrapper.consumer('agent-manager-moderation-content-blocked-draft')).listen();
        new AgentFeedAnswerReceivedListener(kafkaWrapper.consumer('agent-manager-agent-feed-answer-received')).listen();
        
        // Feed scan listener - signs URLs and forwards to AI Gateway
        new AgentFeedScannedListener(kafkaWrapper.consumer('agent-manager-agent-feed-scanned')).listen();
        
        // Presence Coordinator listeners
        new RoomAgentInvitedListener(kafkaWrapper.consumer('agent-manager-room-agent-invited')).listen();
        new AgentInviteOwnerApprovedListener(kafkaWrapper.consumer('agent-manager-agent-invite-owner-approved')).listen();
        // new AgentInviteRequestedListener(kafkaWrapper.consumer('agent-manager-agent-invite-requested')).listen();
        
        // Safety Enforcer listeners
        new ModerationAgentSuspendedListener(kafkaWrapper.consumer('agent-manager-moderation-agent-suspended')).listen();
        new ModerationAgentMutedListener(kafkaWrapper.consumer('agent-manager-moderation-agent-muted')).listen();
        new ModerationAgentForceLeaveRoomListener(kafkaWrapper.consumer('agent-manager-moderation-agent-force-leave-room')).listen();
        new ModerationContentBlockedListener(kafkaWrapper.consumer('agent-manager-moderation-content-blocked')).listen();

        // User and Agent projection listeners
        new UserCreatedListener(kafkaWrapper.consumer('agent-manager-user-created')).listen();
        new AgentCreatedListener(kafkaWrapper.consumer('agent-manager-agent-created')).listen();
        new AgentUpdatedListener(kafkaWrapper.consumer('agent-manager-agent-updated')).listen();
        new AgentIngestedListener(kafkaWrapper.consumer('agent-manager-agent-ingested')).listen();
        new AgentDraftUpdatedListener(kafkaWrapper.consumer('agent-manager-agent-draft-updated')).listen();

        console.log("All Kafka listeners started successfully");

        // Note: Activity Worker removed - feed scanning is now handled by Feed Service
        // activityWorker.start(); // Removed - redundant

        app.listen(3000, () => {
            console.log("app listening on port 3000! agent-manager service");
        });
        
    } catch (err) {
        console.error("Error starting service:", err);
        process.exit(1);
    }
};

startMongoose();

