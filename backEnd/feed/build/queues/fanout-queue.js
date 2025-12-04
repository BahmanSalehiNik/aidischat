"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fanoutQueue = void 0;
// src/queues/fanout-queue.ts
const bullmq_1 = require("bullmq");
exports.fanoutQueue = new bullmq_1.Queue('fanout-job', {
    connection: { host: process.env.REDIS_HOST || 'expiration-redis-srv', port: 6379 },
});
