/**
 * Simple Kafka wrapper that mirrors the pattern used by other services.
 * Exposes a shared producer and factory for consumer groups so each
 * listener can own its own group ID.
 */
import { Kafka, Producer, Consumer } from "kafkajs";

class KafkaWrapper {
    private _client?: Kafka;
    private _producer?: Producer;

    get client() {
        if (!this._client) {
            throw new Error("Cannot access Kafka client before connecting");
        }
        return this._client;
    }

    get producer() {
        if (!this._producer) {
            throw new Error("Cannot access Kafka producer before connecting");
        }
        return this._producer;
    }

    consumer(groupId: string): Consumer {
        if (!this._client) {
            throw new Error("Cannot access Kafka client before connecting");
        }
        return this._client.consumer({ groupId });
    }

    async connect(brokers: string[], clientId = "agent-learning-service") {
        this._client = new Kafka({ clientId, brokers });
        this._producer = this._client.producer();
        await this._producer.connect();
        console.log("Kafka connected");
    }

    async disconnect() {
        await this._producer?.disconnect();
    }
}

export const kafkaWrapper = new KafkaWrapper();

