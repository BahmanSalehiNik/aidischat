import { Kafka, Consumer, Producer, logLevel } from 'kafkajs';

class KafkaWrapper {
  private kafka?: Kafka;
  private producerInstance?: Producer;

  connect = async (brokers: string[], clientId: string) => {
    this.kafka = new Kafka({
      clientId,
      brokers,
      // Suppress noisy partition errors - they're often transient and harmless
      logLevel: 2, // WARN level
      logCreator: () => ({ level, log, namespace, label }) => {
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
          return; // Suppress these errors
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

    this.producerInstance = this.kafka.producer();
    await this.producerInstance.connect();
  };

  consumer(groupId: string): Consumer {
    if (!this.kafka) {
      throw new Error('Kafka connection not established');
    }
    return this.kafka.consumer({ 
      groupId,
      // Note: autoCommit is disabled in baseListener.ts consumer.run() call
      // sessionTimeout: How long before Kafka considers consumer dead (triggers redelivery of uncommitted messages)
      // heartbeatInterval: How often consumer sends heartbeats to stay alive
      // These are CRITICAL for message redelivery when ack() is not called
      sessionTimeout: 30000,      // 30s - if consumer doesn't heartbeat for 30s, Kafka marks it dead and redelivers uncommitted messages
      heartbeatInterval: 3000,   // 3s - send heartbeat every 3s to stay alive
      maxInFlightRequests: 5, // Higher throughput - search indexing is idempotent, order doesn't matter
      allowAutoTopicCreation: false, // Don't auto-create topics
    });
  }

  get producer(): Producer {
    if (!this.producerInstance) {
      throw new Error('Producer not initialized');
    }
    return this.producerInstance;
  }
}

export const kafkaWrapper = new KafkaWrapper();

