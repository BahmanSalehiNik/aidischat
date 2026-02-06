import { AgentDraftPost, AgentDraftPostDoc } from '../../models/agent-draft-post';
import { AgentDraftComment, AgentDraftCommentDoc } from '../../models/agent-draft-comment';
import { AgentDraftReaction, AgentDraftReactionDoc } from '../../models/agent-draft-reaction';
import { Visibility } from '@aichatwar/shared';
import { v4 as uuidv4 } from 'uuid';

const MAX_PENDING_DRAFTS = 50;
const DRAFT_EXPIRY_DAYS = 7;

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export class DraftHandler {
  /**
   * Create a post draft from an activity suggestion
   */
  async createPostDraft(data: {
    agentId: string;
    ownerUserId: string;
    content: string;
    mediaIds?: string[];
    visibility?: Visibility;
    metadata?: {
      suggestedBy: 'activity_worker' | 'manual' | 'ai_gateway';
      confidence?: number;
      context?: string;
    };
  }): Promise<AgentDraftPostDoc> {
    // Check draft limit
    const pendingCount = await AgentDraftPost.countDocuments({
      agentId: data.agentId,
      status: 'pending',
    });

    if (pendingCount >= MAX_PENDING_DRAFTS) {
      throw new Error('Maximum pending drafts reached');
    }

    const draft = AgentDraftPost.build({
      id: uuidv4(),
      agentId: data.agentId,
      ownerUserId: data.ownerUserId,
      content: data.content,
      mediaIds: data.mediaIds,
      visibility: data.visibility || Visibility.Public,
      status: 'pending',
      expiresAt: addDays(new Date(), DRAFT_EXPIRY_DAYS),
      metadata: data.metadata,
    });

    await draft.save();
    return draft;
  }

  /**
   * Create a comment draft from an activity suggestion
   */
  async createCommentDraft(data: {
    agentId: string;
    ownerUserId: string;
    postId: string;
    content: string;
    metadata?: {
      suggestedBy: 'activity_worker' | 'manual' | 'ai_gateway';
      confidence?: number;
      context?: string;
    };
  }): Promise<AgentDraftCommentDoc> {
    const pendingCount = await AgentDraftComment.countDocuments({
      agentId: data.agentId,
      status: 'pending',
    });

    if (pendingCount >= MAX_PENDING_DRAFTS) {
      throw new Error('Maximum pending drafts reached');
    }

    const draft = AgentDraftComment.build({
      id: uuidv4(),
      agentId: data.agentId,
      ownerUserId: data.ownerUserId,
      postId: data.postId,
      content: data.content,
      status: 'pending',
      expiresAt: addDays(new Date(), DRAFT_EXPIRY_DAYS),
      metadata: data.metadata,
    });

    await draft.save();
    return draft;
  }

  /**
   * Create a reaction draft from an activity suggestion
   */
  async createReactionDraft(data: {
    agentId: string;
    ownerUserId: string;
    targetType: 'post' | 'comment';
    targetId: string;
    reactionType: 'like' | 'love' | 'haha' | 'sad' | 'angry';
    metadata?: {
      suggestedBy: 'activity_worker' | 'manual' | 'ai_gateway';
      confidence?: number;
      context?: string;
    };
  }): Promise<AgentDraftReactionDoc> {
    const pendingCount = await AgentDraftReaction.countDocuments({
      agentId: data.agentId,
      status: 'pending',
    });

    if (pendingCount >= MAX_PENDING_DRAFTS) {
      throw new Error('Maximum pending drafts reached');
    }

    // Avoid duplicate drafts for the same target (per agent)
    const existingForTarget = await AgentDraftReaction.findOne({
      agentId: data.agentId,
      targetType: data.targetType,
      targetId: data.targetId,
      status: { $in: ['pending', 'approved'] },
    })
      .select('_id')
      .lean();
    if (existingForTarget) {
      throw new Error('Reaction draft already exists for this target');
    }

    const draft = AgentDraftReaction.build({
      id: uuidv4(),
      agentId: data.agentId,
      ownerUserId: data.ownerUserId,
      targetType: data.targetType,
      targetId: data.targetId,
      reactionType: data.reactionType,
      status: 'pending',
      expiresAt: addDays(new Date(), DRAFT_EXPIRY_DAYS),
      metadata: data.metadata,
    });

    await draft.save();
    return draft;
  }

  /**
   * Approve a post draft
   */
  async approvePostDraft(draftId: string, ownerUserId: string, edits?: { content?: string; mediaIds?: string[]; visibility?: Visibility }): Promise<AgentDraftPostDoc> {
    const draft = await AgentDraftPost.findById(draftId);
    
    if (!draft) {
      throw new Error('Draft not found');
    }

    if (draft.ownerUserId !== ownerUserId) {
      throw new Error('Unauthorized: Only owner can approve drafts');
    }

    if (draft.status !== 'pending') {
      throw new Error('Draft is not pending');
    }

    // Apply edits if provided
    if (edits) {
      if (edits.content) draft.content = edits.content;
      if (edits.mediaIds) draft.mediaIds = edits.mediaIds;
      if (edits.visibility) draft.visibility = edits.visibility;
      await draft.save();
    }

    // Update draft status
    draft.status = 'approved';
    draft.approvedAt = new Date();
    await draft.save();

    return draft;
  }

  /**
   * Approve a comment draft
   */
  async approveCommentDraft(draftId: string, ownerUserId: string, edits?: { content?: string }): Promise<AgentDraftCommentDoc> {
    const draft = await AgentDraftComment.findById(draftId);
    
    if (!draft) {
      throw new Error('Draft not found');
    }

    if (draft.ownerUserId !== ownerUserId) {
      throw new Error('Unauthorized: Only owner can approve drafts');
    }

    if (draft.status !== 'pending') {
      throw new Error('Draft is not pending');
    }

    if (edits?.content) {
      draft.content = edits.content;
      await draft.save();
    }

    draft.status = 'approved';
    draft.approvedAt = new Date();
    await draft.save();

    return draft;
  }

  /**
   * Approve a reaction draft
   */
  async approveReactionDraft(draftId: string, ownerUserId: string, edits?: { reactionType?: 'like' | 'love' | 'haha' | 'sad' | 'angry' }): Promise<AgentDraftReactionDoc> {
    const draft = await AgentDraftReaction.findById(draftId);
    
    if (!draft) {
      throw new Error('Draft not found');
    }

    if (draft.ownerUserId !== ownerUserId) {
      throw new Error('Unauthorized: Only owner can approve drafts');
    }

    if (draft.status !== 'pending') {
      throw new Error('Draft is not pending');
    }

    if (edits?.reactionType) {
      draft.reactionType = edits.reactionType;
      await draft.save();
    }

    draft.status = 'approved';
    draft.approvedAt = new Date();
    await draft.save();

    return draft;
  }

  /**
   * Reject a draft
   */
  async rejectDraft(
    draftId: string,
    ownerUserId: string,
    draftType: 'post' | 'comment' | 'reaction',
    reason?: string
  ): Promise<void> {
    let draft: AgentDraftPostDoc | AgentDraftCommentDoc | AgentDraftReactionDoc | null = null;

    switch (draftType) {
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
      throw new Error('Draft not found');
    }

    if (draft.ownerUserId !== ownerUserId) {
      throw new Error('Unauthorized: Only owner can reject drafts');
    }

    if (draft.status !== 'pending') {
      throw new Error('Draft is not pending');
    }

    draft.status = 'rejected';
    (draft as any).rejectedAt = new Date();
    if (reason) {
      (draft as any).rejectionReason = reason;
    }
    await draft.save();
  }
}

export const draftHandler = new DraftHandler();

