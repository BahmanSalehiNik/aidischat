/**
 * Handles both eligibility scheduling and dataset job execution.
 * Produces TrainingDatasetReadyEvent once enough high-quality
 * interactions are aggregated.
 */
import { AgentLearningSummary } from "../models/agent-learning-summary";
import { AgentFeedbackAggregation } from "../models/agent-feedback-aggregation";
import { HighQualityInteraction } from "../models/high-quality-interaction";
import { TrainingJob } from "../models/training-job";
import { TrainingDatasetReadyEvent } from "@aichatwar/shared";
import { enqueueDatasetJob } from "../queues/dataset-queue";
import { TrainingDatasetReadyPublisher } from "../events/publishers/training-dataset-ready-publisher";
import { kafkaWrapper } from "../kafka-client";
import crypto from "crypto";

const MIN_HIGH_QUALITY = 50;
const POSITIVE_THRESHOLD = 100;
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

export class DatasetGenerator {
    static async scheduleEligibleAgents(): Promise<void> {
        const candidates = await AgentFeedbackAggregation.find({
            positiveCount: { $gte: POSITIVE_THRESHOLD }
        }).lean();

        for (const candidate of candidates) {
            const highQualityCount = await HighQualityInteraction.countDocuments({
                agentId: candidate.agentId
            });
            if (highQualityCount < MIN_HIGH_QUALITY) continue;

            const lastJob = await TrainingJob.findOne({ agentId: candidate.agentId })
                .sort({ createdAt: -1 })
                .lean();

            if (lastJob && Date.now() - lastJob.createdAt.getTime() < COOLDOWN_MS) {
                continue;
            }

            const datasetId = crypto.randomUUID();
            const job = await TrainingJob.create({
                agentId: candidate.agentId,
                datasetId,
                status: "pending"
            });

            await enqueueDatasetJob({ jobId: job.id, agentId: candidate.agentId });
        }
    }

    static async processJob({ jobId, agentId }: { jobId: string; agentId: string }): Promise<void> {
        const job = await TrainingJob.findById(jobId);
        if (!job) return;

        job.status = "running";
        job.startedAt = new Date();
        await job.save();

        const summary = await AgentLearningSummary.findOne({ agentId });
        const aggregation = await AgentFeedbackAggregation.findOne({ agentId });

        if (!summary || !aggregation) {
            job.status = "failed";
            job.errorMessage = "Missing projections";
            await job.save();
            return;
        }

        const interactions = await HighQualityInteraction.find({ agentId })
            .sort({ timestamp: -1 })
            .limit(200)
            .lean();

        if (!interactions.length) {
            job.status = "failed";
            job.errorMessage = "No high-quality interactions";
            await job.save();
            return;
        }

        const first = interactions[interactions.length - 1];
        const last = interactions[0];

        const payload: TrainingDatasetReadyEvent['data'] = {
            agentId,
            datasetId: job.datasetId,
            highQualityInteractions: interactions.map(item => ({
                messageId: item.messageId,
                userMessage: item.userMessage || "",
                agentResponse: item.agentResponse || "",
                feedbackScore: item.feedbackScore,
                context: {
                    roomId: item.roomId || "",
                    timestamp: item.timestamp.toISOString()
                }
            })),
            learnedTraits: summary.traits,
            feedbackStats: {
                totalFeedback: aggregation.totalFeedback,
                positiveCount: aggregation.positiveCount,
                averageSentiment: aggregation.rewardSum / Math.max(aggregation.totalFeedback, 1)
            },
            timeWindow: {
                start: first.timestamp.toISOString(),
                end: last.timestamp.toISOString()
            },
            createdAt: new Date().toISOString()
        };

        await new TrainingDatasetReadyPublisher(kafkaWrapper.producer).publish(payload);

        job.status = "completed";
        job.finishedAt = new Date();
        await job.save();
    }
}

