import { Kafka } from 'kafkajs';

/**
 * KafkaWrapper for Realtime Gateway
 * 
 * IMPORTANT: Consumer Group
 * All Gateway pods use the same groupId: 'realtime-gateway-group'
 * This ensures Kafka delivers each message.created to exactly ONE pod.
 * 
 * Why this matters:
 * - Without consumer groups, every pod would process every message
 * - With consumer groups, only one pod consumes from Kafka
 * - That pod then triggers Redis pub/sub fan-out to ALL pods
 */
class KafkaWrapper {
  private _kafka?: Kafka;
  private _producer?: any;

  get client() {
    if (!this._kafka) {
      throw new Error("Cannot access Kafka client before connecting");
    }
    return this._kafka;
  }

  get producer() {
    if (!this._producer) {
      throw new Error("Cannot access Kafka producer before connecting");
    }
    return this._producer;
  }

  // Single consumer instance for all listeners (old working pattern)
  private _consumer?: any;
  
  get consumer() {
    if (!this._kafka) {
      throw new Error("Cannot access Kafka client before connecting");
    }
    if (!this._consumer) {
      this._consumer = this._kafka.consumer({ 
        groupId: 'realtime-gateway-group',
        sessionTimeout: 30000,
        heartbeatInterval: 3000,
        maxInFlightRequests: 10,
        allowAutoTopicCreation: false,
      });
    }
    return this._consumer;
  }

  // Consumer factory method - kept for backward compatibility but not used in old pattern
  consumerFactory(groupId: string, maxInFlightRequests: number = 10) {
    if (!this._kafka) {
      throw new Error("Cannot access Kafka client before connecting");
    }
    return this._kafka.consumer({ 
      groupId,
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
      maxInFlightRequests,
      allowAutoTopicCreation: false,
    });
  }

  async connect(brokers: string[]) {
    this._kafka = new Kafka({ 
      clientId: 'realtime-gateway', 
      brokers,
      // Connection timeout settings
      connectionTimeout: 10000, // 10 seconds
      requestTimeout: 30000, // 30 seconds
      retry: {
        retries: 8,
        initialRetryTime: 100,
        maxRetryTime: 30000,
        multiplier: 2,
        restartOnFailure: async (e: any) => {
          // Retry on connection errors
          return e.name === 'KafkaJSConnectionError' || 
                 e.name === 'KafkaJSRequestTimeoutError' ||
                 e.name === 'KafkaJSNonRetriableError';
        },
      },
      // Suppress noisy partition errors - they're often transient and harmless
      logLevel: 2, // WARN level
      logCreator: () => ({ level, log, namespace, label }) => {
        // Check if log is a string or object
        const logMessage = typeof log === 'string' ? log : (log.message || JSON.stringify(log));
        const errorMessage = typeof log === 'object' && log.error 
          ? (typeof log.error === 'string' ? log.error : log.error.message || log.error)
          : '';
        
        // Filter out partition errors - these are often transient during startup
        // The error appears in log.error field as a string in KafkaJS logs
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
    this._producer = this._kafka.producer();
    await this._producer.connect();
    console.log('✅ Kafka producer connected');
  }
}

export const kafkaWrapper = new KafkaWrapper();

