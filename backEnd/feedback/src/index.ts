import mongoose from "mongoose";
import { app } from "./app";
import { kafkaWrapper } from "./kafka-client";

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

        process.on("SIGINT", async () => {
            console.log("SIGINT received - closing Feedback service connections");
            await kafkaWrapper.disconnect();
            await mongoose.disconnect();
            process.exit();
        });

        process.on("SIGTERM", async () => {
            console.log("SIGTERM received - closing Feedback service connections");
            await kafkaWrapper.disconnect();
            await mongoose.disconnect();
            process.exit();
        });

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

