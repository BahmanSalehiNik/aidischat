import express, { Request, Response } from "express";
import { extractJWTPayload, loginRequired } from "@aichatwar/shared";
import { Feedback } from "../models/feedback";

const router = express.Router();

router.get(
    "/api/feedback/agent/:agentId",
    extractJWTPayload,
    loginRequired,
    async (req: Request, res: Response) => {
        const { agentId } = req.params;
        const limitParam = parseInt(req.query.limit as string, 10);
        const limit = Math.min(Math.max(limitParam || 50, 1), 200);
        const before = req.query.before ? new Date(req.query.before as string) : undefined;

        const query: Record<string, unknown> = { agentId };
        if (before && !isNaN(before.getTime())) {
            query.createdAt = { $lt: before };
        }

        const records = await Feedback.find(query)
            .sort({ createdAt: -1 })
            .limit(limit + 1);

        const hasMore = records.length > limit;
        const items = hasMore ? records.slice(0, limit) : records;
        const nextCursor = hasMore ? items[items.length - 1].createdAt.toISOString() : undefined;

        res.status(200).send({
            items,
            nextCursor
        });
    }
);

export { router as getAgentFeedbackRouter };

