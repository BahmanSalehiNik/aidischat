import express, { Request, Response } from 'express';
import { body, param, query } from 'express-validator';
import { loginRequired, extractJWTPayload, validateRequest, NotFoundError, BadRequestError, NotAuthorizedError } from '@aichatwar/shared';
import { AgentDraftPost } from '../models/agent-draft-post';
import { AgentDraftComment } from '../models/agent-draft-comment';
import { AgentDraftReaction } from '../models/agent-draft-reaction';
import { draftHandler } from '../modules/draft-handler/draftHandler';
import {
  AgentDraftPostApprovedPublisher,
  AgentDraftCommentApprovedPublisher,
  AgentDraftReactionApprovedPublisher,
  AgentDraftRejectedPublisher,
  AgentDraftUpdatedPublisher,
} from '../events/publishers/agentManagerPublishers';
import { kafkaWrapper } from '../kafka-client';
import { getInternalMedia } from '../utils/mediaServiceClient';

const router = express.Router();

/**
 * GET /api/agent-manager/agents/:agentId/drafts
 * Get all drafts for an agent
 */
router.get(
  '/api/agent-manager/agents/:agentId/drafts',
  loginRequired,
  extractJWTPayload,
  [
    param('agentId').notEmpty().withMessage('Agent ID is required'),
    query('type').optional().isIn(['post', 'comment', 'reaction']).withMessage('Invalid draft type'),
    query('status').optional().isIn(['pending', 'approved', 'rejected', 'expired']).withMessage('Invalid status'),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    const { agentId } = req.params;
    const { type, status } = req.query;
    const userId = req.jwtPayload!.id;

    // Verify ownership (agents have ownerUserId in User projection)
    // For now, we'll check in the draft query

    let drafts: any[] = [];

    if (type === 'post' || !type) {
      const query: any = { agentId };
      if (status) query.status = status;
      const postDrafts = await AgentDraftPost.find(query)
        .sort({ createdAt: -1 })
        .lean();
      drafts = [...drafts, ...postDrafts.map(d => ({ ...d, draftType: 'post' }))];
    }

    if (type === 'comment' || !type) {
      const query: any = { agentId };
      if (status) query.status = status;
      const commentDrafts = await AgentDraftComment.find(query)
        .sort({ createdAt: -1 })
        .lean();
      drafts = [...drafts, ...commentDrafts.map(d => ({ ...d, draftType: 'comment' }))];
    }

    if (type === 'reaction' || !type) {
      const query: any = { agentId };
      if (status) query.status = status;
      const reactionDrafts = await AgentDraftReaction.find(query)
        .sort({ createdAt: -1 })
        .lean();
      drafts = [...drafts, ...reactionDrafts.map(d => ({ ...d, draftType: 'reaction' }))];
    }

    // Filter by ownership
    const ownedDrafts = drafts.filter((d: any) => d.ownerUserId === userId);

    // Hydrate media for post drafts (so clients can render immediately)
    for (const d of ownedDrafts) {
      if (d.draftType !== 'post') continue;
      if (!d.mediaIds || !Array.isArray(d.mediaIds) || d.mediaIds.length === 0) continue;

      const hydrated: any[] = [];
      for (const mediaIdOrUrl of d.mediaIds) {
        // Backward compatible: allow raw URLs
        if (typeof mediaIdOrUrl === 'string' && mediaIdOrUrl.startsWith('http')) {
          hydrated.push({ id: mediaIdOrUrl, url: mediaIdOrUrl, type: 'image' });
          continue;
        }
        try {
          const media = await getInternalMedia(String(mediaIdOrUrl), 900);
          hydrated.push({ id: String(mediaIdOrUrl), url: media.downloadUrl || media.url, type: media.type || 'image' });
        } catch {
          // fallback: pass through
          hydrated.push({ id: String(mediaIdOrUrl), url: String(mediaIdOrUrl), type: 'image' });
        }
      }
      d.media = hydrated;
    }

    // Ensure clients always get a stable `id` field even when using `.lean()` (which returns `_id`)
    const normalized = ownedDrafts.map((d: any) => ({
      ...d,
      id: String(d.id ?? d._id),
    }));

    res.send({ drafts: normalized });
  }
);

/**
 * GET /api/agent-manager/drafts/:draftId
 * Get a single draft
 */
router.get(
  '/api/agent-manager/drafts/:draftId',
  loginRequired,
  extractJWTPayload,
  [
    param('draftId').notEmpty().withMessage('Draft ID is required'),
    query('type').notEmpty().isIn(['post', 'comment', 'reaction']).withMessage('Draft type is required'),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    const { draftId } = req.params;
    const type = Array.isArray(req.query.type) ? req.query.type[0] : req.query.type;
    const userId = req.jwtPayload!.id;

    let draft: any = null;

    switch (type) {
      case 'post':
        draft = await AgentDraftPost.findById(draftId).lean();
        break;
      case 'comment':
        draft = await AgentDraftComment.findById(draftId).lean();
        break;
      case 'reaction':
        draft = await AgentDraftReaction.findById(draftId).lean();
        break;
    }

    if (!draft) {
      throw new NotFoundError();
    }

    if (draft.ownerUserId !== userId) {
      throw new NotAuthorizedError(['Unauthorized: Only owner can view drafts']);
    }

    // Hydrate media for post drafts
    if (type === 'post' && draft.mediaIds && Array.isArray(draft.mediaIds) && draft.mediaIds.length > 0) {
      const hydrated: any[] = [];
      for (const mediaIdOrUrl of draft.mediaIds) {
        if (typeof mediaIdOrUrl === 'string' && mediaIdOrUrl.startsWith('http')) {
          hydrated.push({ id: mediaIdOrUrl, url: mediaIdOrUrl, type: 'image' });
          continue;
        }
        try {
          const media = await getInternalMedia(String(mediaIdOrUrl), 900);
          hydrated.push({ id: String(mediaIdOrUrl), url: media.downloadUrl || media.url, type: media.type || 'image' });
        } catch {
          hydrated.push({ id: String(mediaIdOrUrl), url: String(mediaIdOrUrl), type: 'image' });
        }
      }
      (draft as any).media = hydrated;
    }

    res.send({
      draft: {
        ...draft,
        id: String((draft as any).id ?? (draft as any)._id),
        draftType: type,
      },
    });
  }
);

/**
 * PATCH /api/agent-manager/drafts/:draftId
 * Update a draft (before approval)
 */
router.patch(
  '/api/agent-manager/drafts/:draftId',
  loginRequired,
  extractJWTPayload,
  [
    param('draftId').notEmpty().withMessage('Draft ID is required'),
    query('type').notEmpty().isIn(['post', 'comment', 'reaction']).withMessage('Draft type is required'),
    body('content').optional().isString().withMessage('Content must be a string'),
    body('mediaIds').optional().isArray().withMessage('Media IDs must be an array'),
    body('visibility').optional().isIn(['public', 'friends', 'private']).withMessage('Invalid visibility'),
    body('reactionType').optional().isIn(['like', 'love', 'haha', 'sad', 'angry']).withMessage('Invalid reaction type'),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    const { draftId } = req.params;
    const type = Array.isArray(req.query.type) ? req.query.type[0] : req.query.type;
    const userId = req.jwtPayload!.id;
    const updates = req.body;

    let draft: any = null;

    switch (type) {
      case 'post':
        draft = await AgentDraftPost.findById(draftId);
        break;
      case 'comment':
        draft = await AgentDraftComment.findById(draftId);
        break;
      case 'reaction':
        draft = await AgentDraftReaction.findById(draftId);
        break;
    }

    if (!draft) {
      throw new NotFoundError();
    }

    if (draft.ownerUserId !== userId) {
      throw new NotAuthorizedError(['Unauthorized: Only owner can update drafts']);
    }

    if (draft.status !== 'pending') {
      throw new BadRequestError('Can only update pending drafts');
    }

    // Apply updates
    if (updates.content) draft.content = updates.content;
    if (updates.mediaIds) draft.mediaIds = updates.mediaIds;
    if (updates.visibility) draft.visibility = updates.visibility;
    if (updates.reactionType) draft.reactionType = updates.reactionType;

    await draft.save();

    res.send({ draft });
  }
);

/**
 * POST /api/agent-manager/drafts/:draftId/approve
 * Approve a draft
 */
router.post(
  '/api/agent-manager/drafts/:draftId/approve',
  loginRequired,
  extractJWTPayload,
  [
    param('draftId').notEmpty().withMessage('Draft ID is required'),
    query('type').notEmpty().isIn(['post', 'comment', 'reaction']).withMessage('Draft type is required'),
    body('edits').optional().isObject().withMessage('Edits must be an object'),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    const { draftId } = req.params;
    const type = Array.isArray(req.query.type) ? req.query.type[0] : req.query.type;
    const userId = req.jwtPayload!.id;
    const { edits } = req.body;

    let approvedDraft: any = null;

    switch (type) {
      case 'post':
        approvedDraft = await draftHandler.approvePostDraft(draftId, userId, edits);
        
        // Publish approval event
        await new AgentDraftPostApprovedPublisher(kafkaWrapper.producer).publish({
          draftId: approvedDraft.id,
          agentId: approvedDraft.agentId,
          ownerUserId: approvedDraft.ownerUserId,
          content: approvedDraft.content,
          mediaIds: approvedDraft.mediaIds,
          visibility: approvedDraft.visibility as 'public' | 'friends' | 'private',
          metadata: {
            originalDraftId: approvedDraft.id,
            approvedAt: approvedDraft.approvedAt!.toISOString(),
          },
          timestamp: new Date().toISOString(),
        });
        break;

      case 'comment':
        approvedDraft = await draftHandler.approveCommentDraft(draftId, userId, edits);
        
        await new AgentDraftCommentApprovedPublisher(kafkaWrapper.producer).publish({
          draftId: approvedDraft.id,
          agentId: approvedDraft.agentId,
          ownerUserId: approvedDraft.ownerUserId,
          postId: approvedDraft.postId,
          content: approvedDraft.content,
          metadata: {
            originalDraftId: approvedDraft.id,
            approvedAt: approvedDraft.approvedAt!.toISOString(),
          },
          timestamp: new Date().toISOString(),
        });
        break;

      case 'reaction':
        approvedDraft = await draftHandler.approveReactionDraft(draftId, userId, edits);
        
        await new AgentDraftReactionApprovedPublisher(kafkaWrapper.producer).publish({
          draftId: approvedDraft.id,
          agentId: approvedDraft.agentId,
          ownerUserId: approvedDraft.ownerUserId,
          targetType: approvedDraft.targetType,
          targetId: approvedDraft.targetId,
          reactionType: approvedDraft.reactionType,
          metadata: {
            originalDraftId: approvedDraft.id,
            approvedAt: approvedDraft.approvedAt!.toISOString(),
          },
          timestamp: new Date().toISOString(),
        });
        break;
    }

    res.send({ draft: approvedDraft, message: 'Draft approved and published' });
  }
);

/**
 * POST /api/agent-manager/drafts/:draftId/reject
 * Reject a draft
 */
router.post(
  '/api/agent-manager/drafts/:draftId/reject',
  loginRequired,
  extractJWTPayload,
  [
    param('draftId').notEmpty().withMessage('Draft ID is required'),
    query('type').notEmpty().isIn(['post', 'comment', 'reaction']).withMessage('Draft type is required'),
    body('reason').optional().isString().withMessage('Reason must be a string'),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    const { draftId } = req.params;
    const type = Array.isArray(req.query.type) ? req.query.type[0] : req.query.type;
    const userId = req.jwtPayload!.id;
    const { reason } = req.body;

    await draftHandler.rejectDraft(draftId, userId, type as 'post' | 'comment' | 'reaction', reason);

    // Get draft to get agentId
    let draft: any = null;
    switch (type) {
      case 'post':
        draft = await AgentDraftPost.findById(draftId);
        break;
      case 'comment':
        draft = await AgentDraftComment.findById(draftId);
        break;
      case 'reaction':
        draft = await AgentDraftReaction.findById(draftId);
        break;
    }

    if (draft) {
      await new AgentDraftRejectedPublisher(kafkaWrapper.producer).publish({
        draftId: draft.id,
        agentId: draft.agentId,
        ownerUserId: draft.ownerUserId,
        reason,
        timestamp: new Date().toISOString(),
      });
    }

    res.send({ message: 'Draft rejected' });
  }
);

/**
 * POST /api/agent-manager/drafts/:draftId/revise
 * Request a revision from the AI agent with owner feedback (post drafts only)
 */
router.post(
  '/api/agent-manager/drafts/:draftId/revise',
  loginRequired,
  extractJWTPayload,
  [
    param('draftId').notEmpty().withMessage('Draft ID is required'),
    query('type').notEmpty().isIn(['post']).withMessage('Draft type must be post'),
    body('feedback').notEmpty().isString().withMessage('feedback is required'),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    const { draftId } = req.params;
    const userId = req.jwtPayload!.id;
    const { feedback } = req.body;

    const draft = await AgentDraftPost.findById(draftId);
    if (!draft) throw new NotFoundError();

    if (draft.ownerUserId !== userId) {
      throw new NotAuthorizedError(['Unauthorized: Only owner can revise drafts']);
    }

    if (draft.status !== 'pending') {
      throw new BadRequestError('Can only revise pending drafts');
    }

    // Store revision metadata (best-effort)
    const existingMeta: any = (draft as any).metadata || {};
    (draft as any).metadata = {
      ...existingMeta,
      revision: {
        requestedAt: new Date().toISOString(),
        feedback,
      },
    };
    await draft.save();

    // Use existing AgentDraftUpdated event as the "revision request" trigger to avoid requiring a shared-package bump.
    await new AgentDraftUpdatedPublisher(kafkaWrapper.producer).publish({
      draftId: draft.id,
      agentId: draft.agentId,
      changes: {
        revisionRequest: {
          feedback,
          requestedBy: draft.ownerUserId,
          requestedAt: new Date().toISOString(),
        },
        currentContent: draft.content,
        currentMediaIds: draft.mediaIds,
      },
      timestamp: new Date().toISOString(),
    });

    res.send({ message: 'Revision requested' });
  }
);

/**
 * POST /api/agent-manager/drafts/bulk-action
 * Bulk approve or reject drafts
 */
router.post(
  '/api/agent-manager/drafts/bulk-action',
  loginRequired,
  extractJWTPayload,
  [
    body('draftIds').isArray().notEmpty().withMessage('Draft IDs array is required'),
    body('type').isIn(['post', 'comment', 'reaction']).withMessage('Draft type is required'),
    body('action').isIn(['approve', 'reject']).withMessage('Action must be approve or reject'),
    body('reason').optional().isString().withMessage('Reason must be a string'),
    body('edits').optional().isObject().withMessage('Edits must be an object'),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    const { draftIds, type, action, reason, edits } = req.body;
    const userId = req.jwtPayload!.id;

    const results = [];

    for (const draftId of draftIds) {
      try {
        if (action === 'approve') {
          let approvedDraft: any = null;
          
          switch (type) {
            case 'post':
              approvedDraft = await draftHandler.approvePostDraft(draftId, userId, edits?.[draftId]);
              await new AgentDraftPostApprovedPublisher(kafkaWrapper.producer).publish({
                draftId: approvedDraft.id,
                agentId: approvedDraft.agentId,
                ownerUserId: approvedDraft.ownerUserId,
                content: approvedDraft.content,
                mediaIds: approvedDraft.mediaIds,
                visibility: approvedDraft.visibility as 'public' | 'friends' | 'private',
                metadata: {
                  originalDraftId: approvedDraft.id,
                  approvedAt: approvedDraft.approvedAt!.toISOString(),
                },
                timestamp: new Date().toISOString(),
              });
              break;
            case 'comment':
              approvedDraft = await draftHandler.approveCommentDraft(draftId, userId, edits?.[draftId]);
              await new AgentDraftCommentApprovedPublisher(kafkaWrapper.producer).publish({
                draftId: approvedDraft.id,
                agentId: approvedDraft.agentId,
                ownerUserId: approvedDraft.ownerUserId,
                postId: approvedDraft.postId,
                content: approvedDraft.content,
                metadata: {
                  originalDraftId: approvedDraft.id,
                  approvedAt: approvedDraft.approvedAt!.toISOString(),
                },
                timestamp: new Date().toISOString(),
              });
              break;
            case 'reaction':
              approvedDraft = await draftHandler.approveReactionDraft(draftId, userId, edits?.[draftId]);
              await new AgentDraftReactionApprovedPublisher(kafkaWrapper.producer).publish({
                draftId: approvedDraft.id,
                agentId: approvedDraft.agentId,
                ownerUserId: approvedDraft.ownerUserId,
                targetType: approvedDraft.targetType,
                targetId: approvedDraft.targetId,
                reactionType: approvedDraft.reactionType,
                metadata: {
                  originalDraftId: approvedDraft.id,
                  approvedAt: approvedDraft.approvedAt!.toISOString(),
                },
                timestamp: new Date().toISOString(),
              });
              break;
          }
          
          results.push({ draftId, status: 'approved', draft: approvedDraft });
        } else {
          await draftHandler.rejectDraft(draftId, userId, type, reason);
          
          let draft: any = null;
          switch (type) {
            case 'post':
              draft = await AgentDraftPost.findById(draftId);
              break;
            case 'comment':
              draft = await AgentDraftComment.findById(draftId);
              break;
            case 'reaction':
              draft = await AgentDraftReaction.findById(draftId);
              break;
          }

          if (draft) {
            await new AgentDraftRejectedPublisher(kafkaWrapper.producer).publish({
              draftId: draft.id,
              agentId: draft.agentId,
              ownerUserId: draft.ownerUserId,
              reason,
              timestamp: new Date().toISOString(),
            });
          }
          
          results.push({ draftId, status: 'rejected' });
        }
      } catch (error: any) {
        results.push({ draftId, status: 'error', error: error.message });
      }
    }

    res.send({ results });
  }
);

export { router as draftsRouter };

