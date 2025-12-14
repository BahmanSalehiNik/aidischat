// src/kafka-client.ts
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

  consumer(groupId: string, maxInFlightRequests: number = 1) {
    if (!this._client) {
      throw new Error("Cannot access Kafka client before connecting");
    }
    return this._client.consumer({ 
      groupId,
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
      maxInFlightRequests,
      allowAutoTopicCreation: false,
    });
  }

  async connect(brokers: string[], clientId = "ar-conversations") {
    this._client = new Kafka({ 
      clientId, 
      brokers,
      connectionTimeout: 10000,
      requestTimeout: 30000,
      retry: {
        retries: 8,
        initialRetryTime: 100,
        maxRetryTime: 30000,
        multiplier: 2,
        restartOnFailure: async (e: any) => {
          return e.name === 'KafkaJSConnectionError' || 
                 e.name === 'KafkaJSRequestTimeoutError' ||
                 e.name === 'KafkaJSNonRetriableError';
        },
      },
      logLevel: 2,
    });

    this._producer = this._client.producer();
    await this._producer.connect();

    console.log("✅ Kafka connected for AR Conversations Service");
  }

  async disconnect() {
    await this._producer?.disconnect();
  }
}

export const kafkaWrapper = new KafkaWrapper();

