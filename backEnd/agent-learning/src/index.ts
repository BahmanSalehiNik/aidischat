/**
 * Agent Learning service entry point.
 * Connects to Mongo + Kafka, registers RLHF listeners,
 * and boots the dataset scheduler/worker loop.
 */
import mongoose from "mongoose";
import { app } from "./app";
import { kafkaWrapper } from "./kafka-client";
import { AgentCreatedListener } from "./events/listeners/agent-created-listener";
import { FeedbackCreatedListener } from "./events/listeners/feedback-created-listener";
import { SessionEndedListener } from "./events/listeners/session-ended-listener";
import { AiMessageReplyListener } from "./events/listeners/ai-message-reply-listener";
import { startDatasetWorker } from "./queues/dataset-queue";
import { DatasetScheduler } from "./services/dataset-scheduler";

const start = async () => {
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
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB");

        const brokers = process.env.KAFKA_BROKER_URL
            ? process.env.KAFKA_BROKER_URL.split(",").map(host => host.trim())
            : [];

        if (!brokers.length) {
            throw new Error("KAFKA_BROKER_URL must include at least one broker");
        }

        await kafkaWrapper.connect(brokers, process.env.KAFKA_CLIENT_ID);
        console.log("Kafka connected successfully");

        startDatasetWorker();
        DatasetScheduler.start();

        new AgentCreatedListener(kafkaWrapper.consumer("agent-learning-agent-created")).listen();
        new FeedbackCreatedListener(kafkaWrapper.consumer("agent-learning-feedback-created")).listen();
        new SessionEndedListener(kafkaWrapper.consumer("agent-learning-session-ended")).listen();
        new AiMessageReplyListener(kafkaWrapper.consumer("agent-learning-ai-message-reply")).listen();

        process.on("SIGINT", async () => {
            console.log("SIGINT received - closing Agent Learning service connections");
            await kafkaWrapper.disconnect();
            await mongoose.disconnect();
            process.exit();
        });

        process.on("SIGTERM", async () => {
            console.log("SIGTERM received - closing Agent Learning service connections");
            await kafkaWrapper.disconnect();
            await mongoose.disconnect();
            process.exit();
        });

        app.listen(3000, () => {
            console.log("Agent Learning service listening on port 3000");
        });
    } catch (err) {
        console.error("Error starting agent-learning service", err);
        process.exit(1);
    }
};

start();

