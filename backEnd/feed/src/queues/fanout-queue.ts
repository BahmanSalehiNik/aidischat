// src/queues/fanout-queue.ts
import { Queue } from 'bullmq';

export const fanoutQueue = new Queue('fanout-job', {
  connection: { host: process.env.REDIS_HOST || 'expiration-redis-srv', port: 6379 },
});
