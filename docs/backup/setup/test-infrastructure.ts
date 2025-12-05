// src/__tests__/setup/test-infrastructure.ts
import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';
import { RedisContainer } from '@testcontainers/redis';
import { MongoMemoryServer } from 'mongodb-memory-server';

export interface TestInfrastructure {
  kafka?: StartedTestContainer;
  redis: StartedTestContainer;
  mongoServer: MongoMemoryServer;
  kafkaBrokerUrl?: string;
  redisUrl: string;
  mongoUri: string;
}

export async function startTestInfrastructure(options?: {
  includeKafka?: boolean;
}): Promise<TestInfrastructure> {
  const { includeKafka = false } = options || {};
  
  console.log('🚀 Starting test infrastructure...');
  
  let kafkaContainer: StartedTestContainer | undefined;
  let kafkaBrokerUrl: string | undefined;
  
  // Start Redis FIRST and set env var immediately
  // This ensures any modules imported after this will use the test Redis URL
  console.log('📦 Starting Redis container...');
  const redisContainer = await new RedisContainer('redis:7-alpine')
    .withExposedPorts(6379)
    .withWaitStrategy(Wait.forLogMessage(/Ready to accept connections/))
    .withStartupTimeout(30000)
    .start();
  
  const redisHost = redisContainer.getHost();
  const redisPort = redisContainer.getMappedPort(6379);
  const redisUrl = `redis://${redisHost}:${redisPort}`;
  
  // Set env var IMMEDIATELY so any subsequent imports use test Redis
  process.env.REDIS_FEEDBACK_URL = redisUrl;
  console.log(`✅ Redis started at ${redisUrl} (env var set)`);
  
  // Start Kafka if requested
  if (includeKafka) {
    console.log('📦 Starting Kafka (Redpanda) container...');
    kafkaContainer = await new GenericContainer('docker.redpanda.com/redpandadata/redpanda:latest')
      .withExposedPorts(9092)
      .withCommand([
        'redpanda',
        'start',
        '--mode', 'dev-container',
        '--smp', '1',
        '--overprovisioned',
        '--node-id', '0',
        '--kafka-addr', 'PLAINTEXT://0.0.0.0:9092',
        '--advertise-kafka-addr', 'PLAINTEXT://localhost:9092',
        '--memory', '512M',
      ])
      .withWaitStrategy(Wait.forLogMessage(/Started Redpanda/))
      .withStartupTimeout(60000)
      .start();
    
    const kafkaHost = kafkaContainer.getHost();
    const kafkaPort = kafkaContainer.getMappedPort(9092);
    kafkaBrokerUrl = `${kafkaHost}:${kafkaPort}`;
    console.log(`✅ Kafka started at ${kafkaBrokerUrl}`);
  }
  
  // Start MongoDB (in-memory for faster tests)
  console.log('📦 Starting MongoDB (in-memory)...');
  const mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  console.log(`✅ MongoDB started at ${mongoUri}`);
  
  return {
    kafka: kafkaContainer,
    redis: redisContainer,
    mongoServer,
    kafkaBrokerUrl,
    redisUrl,
    mongoUri,
  };
}

export async function stopTestInfrastructure(infra: TestInfrastructure): Promise<void> {
  console.log('🛑 Stopping test infrastructure...');
  const promises: Promise<void>[] = [];
  
  if (infra.kafka) {
    promises.push(infra.kafka.stop().then(() => console.log('✅ Kafka stopped')));
  }
  
  promises.push(infra.redis.stop().then(() => console.log('✅ Redis stopped')));
  promises.push(infra.mongoServer.stop().then(() => console.log('✅ MongoDB stopped')));
  
  await Promise.all(promises);
  console.log('✅ Test infrastructure stopped');
}

