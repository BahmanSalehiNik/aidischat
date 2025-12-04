import mongoose from "mongoose";
import { app } from "./app";
import { kafkaWrapper } from "./kafka-client";
import { FeedbackReplyReceivedListener } from "./events/listeners/feedback-reply-received-listener";
import { FeedbackReactionReceivedListener } from "./events/listeners/feedback-reaction-received-listener";
import { AgentCreatedListener } from "./events/listeners/agent-created-listener";
import { feedbackBatchWorker } from "./workers/feedback-batch-worker";
import { redisFeedback } from "./redis-client";

const start = async () => {
    if (!process.env.JWT_DEV) {
        throw new Error("JWT_DEV must be defined!");
    }
    if (!process.env.KAFKA_CLIENT_ID) {
        throw new Error("KAFKA_CLIENT_ID must be defined!");
    }
    if (!process.env.KAFKA_BROKER_URL) {
        throw new Error("KAFKA_BROKER_URL must be defined!");
    }

    try {
        // Connect to MongoDB only for learning models (AgentFeedbackAggregation, AgentLearningSummary, HighQualityInteraction)
        if (process.env.MONGO_URI) {
            await mongoose.connect(process.env.MONGO_URI);
            console.log("Connected to MongoDB (for learning models only)");
        } else {
            throw new Error("MONGO_URI must be defined for learning models!");
        }

        const brokers = process.env.KAFKA_BROKER_URL
            ? process.env.KAFKA_BROKER_URL.split(",").map(host => host.trim())
            : [];

        if (!brokers.length) {
            throw new Error("KAFKA_BROKER_URL must include at least one broker");
        }

        await kafkaWrapper.connect(brokers, process.env.KAFKA_CLIENT_ID);
        console.log("Kafka connected successfully");

        // Connect to Redis
        await redisFeedback.ping();
        console.log("Redis connected successfully");

        // Register Kafka listeners
        new AgentCreatedListener(kafkaWrapper.consumer('feedback-service-agent-created')).listen();
        new FeedbackReplyReceivedListener(kafkaWrapper.consumer('feedback-service-reply-received')).listen();
        new FeedbackReactionReceivedListener(kafkaWrapper.consumer('feedback-service-reaction-received')).listen();
        console.log("Feedback service Kafka listeners started");

        // Start batch worker
        feedbackBatchWorker.start();
        console.log("Feedback batch worker started");

        const gracefulShutdown = async (signal: string) => {
            console.log(`${signal} received - flushing pending batches and closing Feedback service connections`);
            
            // Stop worker
            feedbackBatchWorker.stop();
            
            // Flush all pending batches before shutdown
            try {
                await feedbackBatchWorker.flushAll();
            } catch (err) {
                console.error("Error flushing batches during shutdown:", err);
            }
            
            await kafkaWrapper.disconnect();
            await redisFeedback.quit();
            if (mongoose.connection.readyState === 1) {
                await mongoose.disconnect();
            }
            process.exit();
        };

        process.on("SIGINT", () => gracefulShutdown("SIGINT"));
        process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

        console.log("Feedback service ready (REST + Kafka publishers active)");
        app.listen(3000, () => {
            console.log("Feedback service listening on port 3000");
        });
    } catch (err) {
        console.error("Error starting feedback service", err);
        process.exit(1);
    }
};

start();

