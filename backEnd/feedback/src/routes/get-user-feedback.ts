import express, { Request, Response } from "express";
import { extractJWTPayload, loginRequired } from "@aichatwar/shared";
import { redisFeedback } from "../redis-client";
import { PendingFeedbackItem } from "../services/feedback-batcher-redis";

const router = express.Router();

router.get(
    "/api/feedback/user/:userId",
    extractJWTPayload,
    loginRequired,
    async (req: Request, res: Response) => {
        const { userId } = req.params;
        
        // Scan all feedback windows and filter by userId
        // Note: This is inefficient for large scale - consider removing this endpoint
        const pattern = "feedback:window:*";
        const keys = await redisFeedback.keys(pattern);
        
        const allItems: PendingFeedbackItem[] = [];
        for (const key of keys) {
            const itemsJson = await redisFeedback.lrange(key, 0, -1);
            const items = itemsJson.map((json: string) => JSON.parse(json) as PendingFeedbackItem);
            allItems.push(...items.filter(item => item.userId === userId));
        }
        
        // Sort by createdAt descending (newest first)
        allItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        res.status(200).send({
            items: allItems,
            nextCursor: undefined // No pagination for sliding window
        });
    }
);

export { router as getUserFeedbackRouter };

