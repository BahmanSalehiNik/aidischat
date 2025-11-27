import { Queue, Worker, JobsOptions } from "bullmq";
import IORedis from "ioredis";
/**
 * BullMQ queue for dataset-generation jobs. Workers live in the
 * same service process for now, but can be split out later.
 */
import { DatasetGenerator } from "../services/dataset-generator";

const redisHost = process.env.REDIS_HOST || "redis-srv";
const redisPort = parseInt(process.env.REDIS_PORT || "6379", 10);

const connection = new IORedis({
    host: redisHost,
    port: redisPort
});

const queueName = "agent-learning:dataset";

export interface DatasetJobPayload {
    jobId: string;
    agentId: string;
}

export const datasetQueue = new Queue<DatasetJobPayload>(queueName, { connection });

export async function enqueueDatasetJob(payload: DatasetJobPayload, options?: JobsOptions) {
    await datasetQueue.add("generate-dataset", payload, options);
}

export function startDatasetWorker() {
    new Worker<DatasetJobPayload>(
        queueName,
        async job => {
            await DatasetGenerator.processJob(job.data);
        },
        { connection }
    );
}

