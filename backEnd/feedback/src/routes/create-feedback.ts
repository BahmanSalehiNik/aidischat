import express, { Request, Response } from "express";
import { body } from "express-validator";
import { loginRequired, validateRequest, extractJWTPayload, BadRequestError } from "@aichatwar/shared";
import { Feedback, FeedbackDoc } from "../models/feedback";
import { kafkaWrapper } from "../kafka-client";
import { FeedbackCreatedPublisher } from "../events/publishers/feedback-created-publisher";

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

        const existing = await Feedback.findOne({ userId, agentId, sourceId });
        const payload = {
            feedbackType,
            source,
            sourceId,
            agentId,
            userId,
            roomId,
            value,
            metadata
        };

        let feedback: FeedbackDoc;
        const isUpdate = Boolean(existing);

        if (existing) {
            existing.feedbackType = feedbackType;
            existing.source = source;
            existing.value = value;
            existing.roomId = roomId;
            existing.metadata = metadata;
            await existing.save();
            feedback = existing;
        } else {
            feedback = Feedback.build(payload);
            await feedback.save();
        }

        await new FeedbackCreatedPublisher(kafkaWrapper.producer).publish({
            id: feedback.id,
            feedbackType: feedback.feedbackType,
            source: feedback.source,
            sourceId: feedback.sourceId,
            agentId: feedback.agentId,
            userId: feedback.userId,
            roomId: feedback.roomId,
            value: feedback.value,
            metadata: feedback.metadata,
            createdAt: feedback.createdAt.toISOString(),
            updatedAt: feedback.updatedAt.toISOString()
        });

        res.status(isUpdate ? 200 : 201).send(feedback);
    }
);

export { router as createFeedbackRouter };

