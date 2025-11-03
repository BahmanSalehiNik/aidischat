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
  private _consumer?: any;

  connect(brokers: string[]) {
    this._kafka = new Kafka({ clientId: 'realtime-gateway', brokers });
    this._producer = this._kafka.producer();
    
    // CRITICAL: Same groupId across all pods ensures only ONE pod consumes each message
    this._consumer = this._kafka.consumer({ groupId: 'realtime-gateway-group' });
    
    return Promise.all([this._producer.connect(), this._consumer.connect()]);
  }

  get producer() { return this._producer; }
  get consumer() { return this._consumer; }
}

export const kafkaWrapper = new KafkaWrapper();

