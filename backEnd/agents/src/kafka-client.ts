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

  /**
   * Ensure producer is connected, reconnect if needed
   * This handles cases where the producer connection is lost
   */
  async ensureProducerConnected(): Promise<void> {
    if (!this._producer || !this._client) {
      throw new Error("Kafka client not initialized. Call connect() first.");
    }

    // Try a lightweight operation to check connection
    // If it fails with connection error, reconnect
    try {
      // Use sendBatch with empty array as a lightweight connection check
      // This is cheaper than sending actual messages
      await Promise.race([
        this._producer.sendBatch({ topicMessages: [] }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection check timeout')), 1000)
        )
      ]).catch(() => {
        // Ignore errors - we just want to check if producer is alive
      });
    } catch (error: any) {
      // If connection check fails, reconnect
      await this.reconnectProducer();
    }
  }

  /**
   * Reconnect the producer
   */
  private async reconnectProducer(): Promise<void> {
    if (!this._client) {
      throw new Error("Kafka client not initialized. Call connect() first.");
    }

    console.warn('[KafkaWrapper] Producer disconnected, reconnecting...');
    try {
      // Disconnect existing producer if it exists
      if (this._producer) {
        try {
          await this._producer.disconnect();
        } catch (e) {
          // Ignore disconnect errors - producer might already be disconnected
        }
      }
      
      // Create new producer and connect
      this._producer = this._client.producer();
      await this._producer.connect();
      console.log('[KafkaWrapper] ✅ Producer reconnected successfully');
    } catch (error: any) {
      console.error('[KafkaWrapper] ❌ Failed to reconnect producer:', error.message || error);
      throw error;
    }
  }

  consumer(groupId: string) {
    if (!this._client) {
      throw new Error("Cannot access Kafka client before connecting");
    }
    return this._client.consumer({ 
      groupId,
      // Note: autoCommit is disabled in baseListener.ts consumer.run() call
      // sessionTimeout: How long before Kafka considers consumer dead (triggers redelivery of uncommitted messages)
      // heartbeatInterval: How often consumer sends heartbeats to stay alive
      // These are CRITICAL for message redelivery when ack() is not called
      sessionTimeout: 30000,      // 30s - if consumer doesn't heartbeat for 30s, Kafka marks it dead and redelivers uncommitted messages
      heartbeatInterval: 3000,   // 3s - send heartbeat every 3s to stay alive
      maxInFlightRequests: 1, // Process one message at a time per partition for ordering
      allowAutoTopicCreation: false, // Don't auto-create topics
    });
  }

  async connect(brokers: string[], clientId = "app") {
    this._client = new Kafka({ 
      clientId, 
      brokers,
      // Suppress noisy partition errors - they're often transient and harmless
      logLevel: 2, // WARN level
      logCreator: () => ({ level, log, namespace, label }) => {
        // Check if log is a string or object
        const logMessage = typeof log === 'string' ? log : (log.message || JSON.stringify(log));
        const errorMessage = typeof log === 'object' && log.error 
          ? (typeof log.error === 'string' ? log.error : log.error.message || log.error)
          : '';
        
        // Filter out partition errors - these are often transient during startup
        if (
          logMessage?.includes('does not host this topic-partition') ||
          errorMessage?.includes('does not host this topic-partition') ||
          (logMessage?.includes('ListOffsets') && errorMessage?.includes('does not host')) ||
          (logMessage?.includes('Response Metadata') && errorMessage?.includes('does not host'))
        ) {
          // Suppress these specific errors - they're harmless and transient
          return;
        }
        
        // Only log WARN and ERROR level messages (excluding the filtered ones)
        if (level >= 2) {
          if (level === 2) { // WARN
            console.warn(`[Kafka ${namespace}] ${logMessage}`);
          } else if (level >= 1) { // ERROR
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
