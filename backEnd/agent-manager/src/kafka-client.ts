// shared/kafka/kafka-wrapper.ts
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

  consumer(groupId: string) {
    if (!this._client) {
      throw new Error("Cannot access Kafka client before connecting");
    }
    return this._client.consumer({ 
      groupId,
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
      maxInFlightRequests: 5,
      allowAutoTopicCreation: false,
    });
  }

  async connect(brokers: string[], clientId = "app") {
    this._client = new Kafka({ 
      clientId, 
      brokers,
      logLevel: 2, // WARN level
      logCreator: () => ({ level, log, namespace, label }) => {
        const logMessage = typeof log === 'string' ? log : (log.message || JSON.stringify(log));
        const errorMessage = typeof log === 'object' && log.error 
          ? (typeof log.error === 'string' ? log.error : log.error.message || log.error)
          : '';
        
        if (
          logMessage?.includes('does not host this topic-partition') ||
          errorMessage?.includes('does not host this topic-partition') ||
          (logMessage?.includes('ListOffsets') && errorMessage?.includes('does not host'))
        ) {
          return;
        }
        
        if (level >= 2) {
          if (level === 2) {
            console.warn(`[Kafka ${namespace}] ${logMessage}`);
          } else if (level >= 1) {
            console.error(`[Kafka ${namespace}] ${logMessage}`, typeof log === 'object' && log.error ? log.error : '');
          }
        }
      }
    });

    this._producer = this._client.producer();
    await this._producer.connect();

    console.log("Kafka connected");
  }

  async disconnect() {
    await this._producer?.disconnect();
  }
}

export const kafkaWrapper = new KafkaWrapper();

