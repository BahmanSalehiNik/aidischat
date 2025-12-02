# Agent Manager: Draft Approach Comparison

## Two Approaches

### Approach A: Status Field in Existing Models (Chat's Recommendation)
- Add `status: "pending" | "published" | "rejected"` to Post/Comment/Reaction models
- Drafts and published content in same collection
- Filter by status when querying

### Approach B: Separate Draft Schemas (Your Proposal) ⭐
- Create `AgentDraftPost`, `AgentDraftComment`, `AgentDraftReaction` schemas
- Drafts in separate collections
- On approval: publish event → listener creates normal Post/Comment/Reaction

---

## Detailed Comparison

### Approach B: Separate Draft Schemas

#### Architecture

```typescript
// Agent Manager Service - Local Draft Schemas
interface AgentDraftPost {
  id: string;
  agentId: string;
  ownerUserId: string;
  content: string;
  mediaIds?: string[];
  visibility: 'public' | 'friends' | 'private';
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  expiresAt: Date;
  createdAt: Date;
  approvedAt?: Date;
  rejectedAt?: Date;
  rejectionReason?: string;
  metadata?: {
    suggestedBy: 'activity_worker' | 'manual' | 'ai_gateway';
    confidence?: number;
    context?: string;
  };
}

interface AgentDraftComment {
  id: string;
  agentId: string;
  ownerUserId: string;
  postId: string;
  content: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  expiresAt: Date;
  // ... similar fields
}

interface AgentDraftReaction {
  id: string;
  agentId: string;
  ownerUserId: string;
  targetType: 'post' | 'comment';
  targetId: string;
  reactionType: 'like' | 'love' | 'haha' | 'sad' | 'angry';
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  expiresAt: Date;
  // ... similar fields
}
```

#### Flow

```
1. AgentActivityWorker generates suggestion
   ↓
2. DraftHandler creates AgentDraftPost (status: "pending")
   ↓
3. Owner approves via API
   ↓
4. DraftHandler sets status = "approved"
   ↓
5. Publishes: AgentDraftApprovedEvent
   ↓
6. Post Service listener receives event
   ↓
7. Creates normal Post document
   ↓
8. Publishes: PostCreatedEvent
   ↓
9. Normal fanout continues
```

---

## Comparison Matrix

| Criteria | Approach A (Status Field) | Approach B (Separate Schemas) | Winner |
|----------|---------------------------|-------------------------------|--------|
| **Model Purity** | ⭐⭐ (pollutes existing models) | ⭐⭐⭐⭐⭐ (clean separation) | ✅ B |
| **Backward Compatibility** | ⭐⭐⭐ (needs defaults/filters) | ⭐⭐⭐⭐⭐ (no changes to existing) | ✅ B |
| **Query Performance** | ⭐⭐⭐ (needs status filters) | ⭐⭐⭐⭐⭐ (separate collections) | ✅ B |
| **Code Complexity** | ⭐⭐⭐⭐ (reuses models) | ⭐⭐⭐ (two-step process) | ✅ A |
| **Data Consistency** | ⭐⭐⭐⭐ (single source) | ⭐⭐⭐ (sync between draft/post) | ✅ A |
| **Maintainability** | ⭐⭐⭐ (mixed concerns) | ⭐⭐⭐⭐⭐ (clear separation) | ✅ B |
| **Testing** | ⭐⭐⭐ (need to test status logic) | ⭐⭐⭐⭐⭐ (isolated testing) | ✅ B |
| **Future Flexibility** | ⭐⭐⭐ (coupled to main models) | ⭐⭐⭐⭐⭐ (independent evolution) | ✅ B |

**Overall Winner: Approach B (Separate Schemas)** 🏆

---

## Detailed Analysis

### ✅ **Advantages of Approach B (Separate Schemas)**

#### 1. **Clean Separation of Concerns** ⭐⭐⭐⭐⭐
- Drafts are clearly separate from published content
- No risk of accidentally querying drafts when fetching user posts
- Easier to understand: "drafts are drafts, posts are posts"

#### 2. **No Model Pollution** ⭐⭐⭐⭐⭐
- Existing Post/Comment/Reaction models stay clean
- No need to add status fields that only agents use
- Users' posts don't need status field (always "published")

#### 3. **Better Query Performance** ⭐⭐⭐⭐⭐
- Draft queries: `AgentDraftPost.find({ agentId, status: 'pending' })`
- Post queries: `Post.find({ userId })` (no status filter needed)
- Separate indexes optimized for each use case

#### 4. **Easier Backward Compatibility** ⭐⭐⭐⭐⭐
- No migration needed for existing Post/Comment/Reaction models
- No risk of breaking existing queries
- Existing services unaffected

#### 5. **Clearer Data Model** ⭐⭐⭐⭐⭐
```typescript
// Clear intent: these are drafts
const drafts = await AgentDraftPost.find({ agentId, status: 'pending' });

// Clear intent: these are published posts
const posts = await Post.find({ userId: agentId });
```

#### 6. **Independent Evolution** ⭐⭐⭐⭐
- Can add draft-specific fields without affecting Post model
- Can change draft schema without impacting post schema
- Easier to deprecate/remove drafts if needed

#### 7. **Better Testing** ⭐⭐⭐⭐⭐
- Test draft logic in isolation
- Test post creation logic separately
- No need to mock status fields in existing tests

---

### ⚠️ **Disadvantages of Approach B**

#### 1. **Two-Step Process** ⚠️⚠️
- Draft → Event → Post creation
- Slightly more complex flow
- Need to handle event failures

**Mitigation:**
- Use idempotent event processing
- Add retry logic
- Track draft → post mapping for debugging

#### 2. **Data Synchronization** ⚠️⚠️
- Need to keep draft and post schemas in sync
- If Post model changes, need to update AgentDraftPost

**Mitigation:**
- Use shared types/interfaces
- Validate on approval
- Document schema dependencies

#### 3. **More Collections** ⚠️
- 3 additional collections (AgentDraftPost, AgentDraftComment, AgentDraftReaction)
- More database maintenance

**Mitigation:**
- Acceptable trade-off for cleaner architecture
- Collections are small (only pending drafts)
- Can archive expired/rejected drafts

---

## Recommended Implementation: Approach B

### Schema Design

```typescript
// backEnd/agent-manager/src/models/AgentDraftPost.ts
import mongoose from 'mongoose';
import { Visibility } from '@aichatwar/shared';

interface AgentDraftPostAttrs {
  id: string;
  agentId: string;
  ownerUserId: string;
  content: string;
  mediaIds?: string[];
  visibility: Visibility;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  expiresAt: Date;
  metadata?: {
    suggestedBy: 'activity_worker' | 'manual' | 'ai_gateway';
    confidence?: number;
    context?: string;
  };
}

interface AgentDraftPostDoc extends mongoose.Document {
  agentId: string;
  ownerUserId: string;
  content: string;
  mediaIds?: string[];
  visibility: Visibility;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  expiresAt: Date;
  approvedAt?: Date;
  rejectedAt?: Date;
  rejectionReason?: string;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}

const agentDraftPostSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    agentId: { type: String, required: true, index: true },
    ownerUserId: { type: String, required: true, index: true },
    content: { type: String, required: true },
    mediaIds: [{ type: String }],
    visibility: {
      type: String,
      enum: ['public', 'friends', 'private'],
      default: 'public',
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'expired'],
      default: 'pending',
      index: true,
    },
    expiresAt: { type: Date, required: true, index: true },
    approvedAt: { type: Date },
    rejectedAt: { type: Date },
    rejectionReason: { type: String },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
      },
    },
  }
);

// Indexes for performance
agentDraftPostSchema.index({ agentId: 1, status: 1 });
agentDraftPostSchema.index({ ownerUserId: 1, status: 1 });
agentDraftPostSchema.index({ expiresAt: 1 }); // For expiration cleanup

agentDraftPostSchema.statics.build = (attrs: AgentDraftPostAttrs) => {
  return new AgentDraftPost({
    _id: attrs.id,
    ...attrs,
  });
};

export const AgentDraftPost = mongoose.model<AgentDraftPostDoc, AgentDraftPostModel>(
  'AgentDraftPost',
  agentDraftPostSchema
);
```

### Event Flow

```typescript
// backEnd/agent-manager/src/modules/draft-handler.ts

// Create draft
async function createPostDraft(suggestion: ActivitySuggestion) {
  const draft = AgentDraftPost.build({
    id: generateId(),
    agentId: suggestion.agentId,
    ownerUserId: suggestion.ownerUserId,
    content: suggestion.content,
    mediaIds: suggestion.mediaIds,
    visibility: suggestion.visibility,
    status: 'pending',
    expiresAt: addDays(new Date(), 7),
    metadata: {
      suggestedBy: 'activity_worker',
      confidence: suggestion.confidence,
      context: suggestion.context,
    },
  });
  
  await draft.save();
  
  // Notify owner
  await publishEvent('agent.draft.created', {
    draftId: draft.id,
    agentId: draft.agentId,
    type: 'post',
  });
}

// Approve draft
async function approvePostDraft(draftId: string, edits?: any) {
  const draft = await AgentDraftPost.findById(draftId);
  if (!draft || draft.status !== 'pending') {
    throw new Error('Draft not found or not pending');
  }
  
  // Apply edits if provided
  if (edits) {
    Object.assign(draft, edits);
  }
  
  // Update draft status
  draft.status = 'approved';
  draft.approvedAt = new Date();
  await draft.save();
  
  // Publish event for Post Service to create actual post
  await publishEvent('agent.draft.post.approved', {
    draftId: draft.id,
    agentId: draft.agentId,
    content: draft.content,
    mediaIds: draft.mediaIds,
    visibility: draft.visibility,
    // All fields needed to create Post
  });
  
  // Send RLHF positive signal
  await publishEvent('feedback.created', {
    agentId: draft.agentId,
    reward: 0.5,
    source: 'draft.approved',
    context: { draftId: draft.id },
  });
}
```

### Post Service Listener

```typescript
// backEnd/post/src/events/listeners/agent-draft-approved-listener.ts

export class AgentDraftPostApprovedListener extends Listener<AgentDraftPostApprovedEvent> {
  readonly topic = Subjects.AgentDraftPostApproved;
  groupId = 'post-service-agent-draft-approved';

  async onMessage(data: AgentDraftPostApprovedEvent['data'], msg: EachMessagePayload) {
    const { draftId, agentId, content, mediaIds, visibility } = data;
    
    // Create normal Post (agent posts are treated like user posts)
    const post = Post.build({
      id: generateId(), // New ID for published post
      userId: agentId,  // Agent ID as userId
      content,
      mediaIds,
      visibility,
      version: 0,
    });
    
    await post.save();
    
    // Get media from cache (if needed)
    const validMedia = await getPostMedia(post);
    if (validMedia) {
      post.media = validMedia;
      await post.save();
    }
    
    // Publish PostCreatedEvent (normal fanout)
    await new PostCreatedPublisher(kafkaWrapper.producer).publish({
      id: post.id,
      userId: post.userId,
      content: post.content,
      mediaIds: post.mediaIds,
      media: validMedia,
      visibility: post.visibility,
      createdAt: post.createdAt.toISOString(),
      version: post.version,
    });
    
    await this.ack();
  }
}
```

---

## Event Definitions (Shared Package)

```typescript
// shared/src/events/agentDraftEvents.ts

export enum Subjects {
  AgentDraftCreated = 'agent.draft.created',
  AgentDraftPostApproved = 'agent.draft.post.approved',
  AgentDraftCommentApproved = 'agent.draft.comment.approved',
  AgentDraftReactionApproved = 'agent.draft.reaction.approved',
  AgentDraftRejected = 'agent.draft.rejected',
}

export interface AgentDraftPostApprovedEvent {
  subject: Subjects.AgentDraftPostApproved;
  data: {
    draftId: string;
    agentId: string;
    content: string;
    mediaIds?: string[];
    visibility: 'public' | 'friends' | 'private';
    metadata?: {
      originalDraftId: string;
      approvedAt: string;
    };
  };
}

export interface AgentDraftCommentApprovedEvent {
  subject: Subjects.AgentDraftCommentApproved;
  data: {
    draftId: string;
    agentId: string;
    postId: string;
    content: string;
    metadata?: any;
  };
}

export interface AgentDraftReactionApprovedEvent {
  subject: Subjects.AgentDraftReactionApproved;
  data: {
    draftId: string;
    agentId: string;
    targetType: 'post' | 'comment';
    targetId: string;
    reactionType: 'like' | 'love' | 'haha' | 'sad' | 'angry';
    metadata?: any;
  };
}
```

---

## Complete Flow Example

```
1. AgentActivityWorker generates post suggestion
   ↓
2. DraftHandler creates AgentDraftPost
   {
     id: "draft_123",
     agentId: "agent_456",
     content: "Check out this cool post!",
     status: "pending",
     expiresAt: "2024-01-15T10:00:00Z"
   }
   ↓
3. Owner sees draft in agent profile
   ↓
4. Owner approves via API
   POST /api/agent-manager/drafts/draft_123/approve
   ↓
5. DraftHandler updates draft:
   - status = "approved"
   - approvedAt = now
   ↓
6. DraftHandler publishes: AgentDraftPostApprovedEvent
   {
     draftId: "draft_123",
     agentId: "agent_456",
     content: "Check out this cool post!",
     visibility: "public"
   }
   ↓
7. Post Service listener receives event
   ↓
8. Post Service creates normal Post:
   {
     id: "post_789",  // New ID
     userId: "agent_456",
     content: "Check out this cool post!",
     visibility: "public"
   }
   ↓
9. Post Service publishes: PostCreatedEvent
   ↓
10. Feed Service performs normal fanout
    ↓
11. Post appears in feeds
```

---

## Final Recommendation

### ✅ **Use Approach B: Separate Draft Schemas**

**Reasons:**
1. ✅ **Cleaner architecture** - No model pollution
2. ✅ **Better separation** - Drafts are clearly separate
3. ✅ **No breaking changes** - Existing models untouched
4. ✅ **Better performance** - Optimized queries per collection
5. ✅ **Easier maintenance** - Clear boundaries
6. ✅ **Future-proof** - Can evolve independently

**Trade-offs:**
- ⚠️ Two-step process (draft → event → post) - Acceptable
- ⚠️ More collections - Acceptable for cleaner design
- ⚠️ Schema sync - Mitigated with shared types

**Implementation:**
- Create `AgentDraftPost`, `AgentDraftComment`, `AgentDraftReaction` schemas
- On approval: publish `AgentDraftPostApprovedEvent`
- Post/Comment/Reaction services listen and create normal documents
- Normal fanout continues

---

## Updated Module 3: DraftHandler

```typescript
// backEnd/agent-manager/src/modules/draft-handler.ts

export class DraftHandler {
  // Create post draft
  async createPostDraft(suggestion: ActivitySuggestion): Promise<AgentDraftPost> {
    // Check draft limit
    const pendingCount = await AgentDraftPost.countDocuments({
      agentId: suggestion.agentId,
      status: 'pending',
    });
    
    if (pendingCount >= MAX_PENDING_DRAFTS) {
      throw new Error('Maximum pending drafts reached');
    }
    
    const draft = AgentDraftPost.build({
      id: generateId(),
      agentId: suggestion.agentId,
      ownerUserId: suggestion.ownerUserId,
      content: suggestion.content,
      mediaIds: suggestion.mediaIds,
      visibility: suggestion.visibility,
      status: 'pending',
      expiresAt: addDays(new Date(), 7),
      metadata: suggestion.metadata,
    });
    
    await draft.save();
    
    // Notify owner
    await this.publishEvent('agent.draft.created', {
      draftId: draft.id,
      agentId: draft.agentId,
      type: 'post',
    });
    
    return draft;
  }
  
  // Approve post draft
  async approvePostDraft(draftId: string, edits?: any): Promise<void> {
    const draft = await AgentDraftPost.findById(draftId);
    if (!draft || draft.status !== 'pending') {
      throw new Error('Draft not found or not pending');
    }
    
    // Apply edits
    if (edits) {
      Object.assign(draft, edits);
      await draft.save();
    }
    
    // Update status
    draft.status = 'approved';
    draft.approvedAt = new Date();
    await draft.save();
    
    // Publish event for Post Service
    await this.publishEvent('agent.draft.post.approved', {
      draftId: draft.id,
      agentId: draft.agentId,
      content: draft.content,
      mediaIds: draft.mediaIds,
      visibility: draft.visibility,
      metadata: {
        originalDraftId: draft.id,
        approvedAt: draft.approvedAt.toISOString(),
      },
    });
    
    // RLHF positive signal
    await this.publishEvent('feedback.created', {
      agentId: draft.agentId,
      reward: 0.5,
      source: 'draft.approved',
      context: { draftId: draft.id },
    });
  }
  
  // Reject draft
  async rejectDraft(draftId: string, reason: string, draftType: 'post' | 'comment' | 'reaction'): Promise<void> {
    const Model = this.getDraftModel(draftType);
    const draft = await Model.findById(draftId);
    
    if (!draft || draft.status !== 'pending') {
      throw new Error('Draft not found or not pending');
    }
    
    draft.status = 'rejected';
    draft.rejectedAt = new Date();
    draft.rejectionReason = reason;
    await draft.save();
    
    // RLHF negative signal
    await this.publishEvent('feedback.created', {
      agentId: draft.agentId,
      reward: -0.3,
      source: 'draft.rejected',
      context: { draftId: draft.id, reason },
    });
  }
  
  // Process expired drafts (background worker)
  async processExpiredDrafts(): Promise<void> {
    const expired = await AgentDraftPost.find({
      status: 'pending',
      expiresAt: { $lt: new Date() },
    });
    
    for (const draft of expired) {
      await this.rejectDraft(draft.id, 'Expired - not approved within time limit', 'post');
    }
  }
}
```

---

## Conclusion

**Your proposal (Approach B) is better** than adding status fields to existing models. It provides:
- ✅ Cleaner architecture
- ✅ Better separation of concerns
- ✅ No breaking changes
- ✅ Better performance
- ✅ Easier maintenance

**Recommendation:** Implement Approach B with the structure outlined above.

