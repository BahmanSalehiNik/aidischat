import express, { Request, Response } from "express";
import { extractJWTPayload, loginRequired } from "@aichatwar/shared";
import { redisFeedback, RedisFeedbackKeys } from "../redis-client";
import { PendingFeedbackItem } from "../services/feedback-batcher-redis";

const router = express.Router();

router.get(
    "/api/feedback/agent/:agentId",
    extractJWTPayload,
    loginRequired,
    async (req: Request, res: Response) => {
        const { agentId } = req.params;
        const roomId = req.query.roomId as string | undefined;

        // Get items from Redis sliding window for this agentId+roomId
        const windowKey = RedisFeedbackKeys.window(agentId, roomId);
        const itemsJson = await redisFeedback.lrange(windowKey, 0, -1);
        
        const items: PendingFeedbackItem[] = itemsJson.map((json: string) => JSON.parse(json) as PendingFeedbackItem);
        
        // Sort by createdAt descending (newest first)
        items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        res.status(200).send({
            items,
            nextCursor: undefined // No pagination for sliding window (max 5 items)
        });
    }
);

export { router as getAgentFeedbackRouter };

