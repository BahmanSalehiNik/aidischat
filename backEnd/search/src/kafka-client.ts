import { Kafka, Consumer, Producer, logLevel } from 'kafkajs';

class KafkaWrapper {
  private kafka?: Kafka;
  private producerInstance?: Producer;

  connect = async (brokers: string[], clientId: string) => {
    this.kafka = new Kafka({
      clientId,
      brokers,
      logLevel: logLevel.INFO,
    });

    this.producerInstance = this.kafka.producer();
    await this.producerInstance.connect();
  };

  consumer(groupId: string): Consumer {
    if (!this.kafka) {
      throw new Error('Kafka connection not established');
    }
    return this.kafka.consumer({ groupId });
  }

  get producer(): Producer {
    if (!this.producerInstance) {
      throw new Error('Producer not initialized');
    }
    return this.producerInstance;
  }
}

export const kafkaWrapper = new KafkaWrapper();

