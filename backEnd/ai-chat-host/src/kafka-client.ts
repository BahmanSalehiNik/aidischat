import { Kafka, Producer, Consumer } from "kafkajs";
import { KAFKA_CONFIG } from './config/constants';

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

  async connect(brokers?: string[], clientId?: string) {
    const finalBrokers = brokers || KAFKA_CONFIG.BROKERS;
    const finalClientId = clientId || KAFKA_CONFIG.CLIENT_ID;
    
    this._client = new Kafka({ 
      clientId: finalClientId, 
      brokers: finalBrokers,
      logLevel: 2, // WARN level
      logCreator: () => ({ level, log, namespace, label }) => {
        const logMessage = typeof log === 'string' ? log : (log.message || JSON.stringify(log));
        const errorMessage = typeof log === 'object' && log.error 
          ? (typeof log.error === 'string' ? log.error : log.error.message || log.error)
          : '';
        
        // Filter out partition errors
        if (
          logMessage?.includes('does not host this topic-partition') ||
          errorMessage?.includes('does not host this topic-partition')
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

    console.log("✅ [AI Chat Host] Kafka connected");
  }

  async disconnect() {
    await this._producer?.disconnect();
    console.log("✅ [AI Chat Host] Kafka disconnected");
  }
}

export const kafkaWrapper = new KafkaWrapper();

