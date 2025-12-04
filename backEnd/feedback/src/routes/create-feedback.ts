import express, { Request, Response } from "express";
import { body } from "express-validator";
import { loginRequired, validateRequest, extractJWTPayload, BadRequestError } from "@aichatwar/shared";
import { feedbackBatcherRedis } from "../services/feedback-batcher-redis";

const router = express.Router();

const feedbackTypes = ['explicit', 'implicit', 'reaction'];
const sources = ['chat', 'post', 'comment', 'profile'];
const reactionTypes = ['like', 'love', 'laugh', 'wow', 'sad', 'dislike'];

router.post(
    "/api/feedback",
    extractJWTPayload,
    loginRequired,
    [
        body("feedbackType")
            .isIn(feedbackTypes)
            .withMessage("feedbackType must be explicit, implicit, or reaction"),
        body("source")
            .isIn(sources)
            .withMessage("source must be chat, post, comment, or profile"),
        body("sourceId")
            .trim()
            .notEmpty()
            .withMessage("sourceId is required"),
        body("agentId")
            .trim()
            .notEmpty()
            .withMessage("agentId is required"),
        body("value")
            .isFloat({ min: -1, max: 1 })
            .withMessage("value must be between -1 and 1"),
        body("metadata").optional().isObject().withMessage("metadata must be an object"),
        body("metadata.rating").optional().isFloat({ min: 1, max: 5 }).withMessage("rating must be between 1 and 5"),
        body("metadata.reactionType").optional().isIn(reactionTypes).withMessage("invalid reaction type")
    ],
    validateRequest,
    async (req: Request, res: Response) => {
        const userId = req.jwtPayload?.id;
        if (!userId) {
            throw new BadRequestError("Missing user information");
        }

        const { feedbackType, source, sourceId, agentId, roomId, value, metadata } = req.body;

        // Add to Redis sliding window for processing through learning pipeline
        await feedbackBatcherRedis.add({
            feedbackType,
            source,
            sourceId,
            agentId,
            userId,
            roomId,
            value,
            metadata,
            receivedAt: new Date().toISOString()
        });

        // Return the feedback data (not stored in DB)
        const feedback = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            feedbackType,
            source,
            sourceId,
            agentId,
            userId,
            roomId,
            value,
            metadata,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        res.status(201).send(feedback);
    }
);

export { router as createFeedbackRouter };

