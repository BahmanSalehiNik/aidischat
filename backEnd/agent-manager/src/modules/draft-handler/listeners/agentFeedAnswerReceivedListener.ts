// src/modules/draft-handler/listeners/agentFeedAnswerReceivedListener.ts
import { Listener, Subjects, AgentFeedAnswerReceivedEvent, EachMessagePayload } from '@aichatwar/shared';
import { draftHandler } from '../draftHandler';
import { AgentDraftPostCreatedPublisher, AgentDraftCommentCreatedPublisher, AgentDraftReactionCreatedPublisher, AgentDraftConnectionRequestCreatedPublisher } from '../../../events/publishers/agentManagerPublishers';
import { kafkaWrapper } from '../../../kafka-client';
import { v4 as uuidv4 } from 'uuid';
import { Visibility } from '@aichatwar/shared';
import { importImageFromUrl } from '../../../utils/mediaServiceClient';

export class AgentFeedAnswerReceivedListener extends Listener<AgentFeedAnswerReceivedEvent> {
  readonly topic = Subjects.AgentFeedAnswerReceived;
  readonly groupId = 'agent-manager-agent-feed-answer-received';
  protected fromBeginning: boolean = true;

  async onMessage(data: AgentFeedAnswerReceivedEvent['data'], msg: EachMessagePayload): Promise<void> {
    const { agentId, ownerUserId, scanId, correlationId, response, metadata, timestamp } = data;

    console.log(`[AgentFeedAnswerReceivedListener] Received feed answer for agent ${agentId} (scanId: ${scanId})`);

    try {
      const createdDrafts: Array<{ type: string; draftId: string }> = [];

      // Process posts
      if (response.posts && Array.isArray(response.posts)) {
        for (const post of response.posts) {
          try {
            // Ensure every agent draft post gets at least one image
            const sourceImageUrls: string[] =
              post.mediaUrls && Array.isArray(post.mediaUrls) && post.mediaUrls.length > 0
                ? post.mediaUrls
                : [`https://picsum.photos/seed/${encodeURIComponent(`${agentId}-${scanId}`)}/1024/768`];

            // Convert public image URL(s) into Media IDs in media service (uploaded to storage + registered)
            const mediaIds: string[] = [];
            const mediaUrlsForEvent: string[] = [];

            // Only take 1 for now to keep drafts lightweight
            const firstUrl = sourceImageUrls[0];
            try {
              const imported = await importImageFromUrl({
                userId: ownerUserId, // owner can review/delete
                agentId,
                sourceUrl: firstUrl,
                container: 'posts',
                expiresSeconds: 900,
              });
              mediaIds.push(imported.id);
              if (imported.downloadUrl) mediaUrlsForEvent.push(imported.downloadUrl);
              else if (imported.url) mediaUrlsForEvent.push(imported.url);
            } catch (mediaError: any) {
              // As a fallback, keep the external URL (draft will still have an image preview)
              console.error(`[AgentFeedAnswerReceivedListener] Error importing media, falling back to external URL:`, mediaError.message);
              mediaUrlsForEvent.push(firstUrl);
            }

            const draft = await draftHandler.createPostDraft({
              agentId,
              ownerUserId,
              content: post.content,
              mediaIds: mediaIds.length > 0 ? mediaIds : mediaUrlsForEvent, // prefer real media IDs, fallback to URL strings
              visibility: (post.visibility as Visibility) || Visibility.Public,
              metadata: {
                suggestedBy: 'ai_gateway',
                context: `From feed scan ${scanId}`,
              },
            });

            // Publish draft created event
            await new AgentDraftPostCreatedPublisher(kafkaWrapper.producer).publish({
              draftId: draft.id,
              agentId,
              ownerUserId,
              content: draft.content,
              mediaUrls: mediaUrlsForEvent, // best-effort preview URL(s)
              visibility: draft.visibility,
              status: 'pending',
              expiresAt: draft.expiresAt.toISOString(),
              metadata: {
                scanId,
                suggestedBy: 'activity_worker', // Note: This should be 'ai_gateway' but event interface uses 'activity_worker'
                confidence: undefined,
                context: `From feed scan ${scanId}`,
              },
              timestamp: new Date().toISOString(),
            });

            createdDrafts.push({ type: 'post', draftId: draft.id });
            console.log(`[AgentFeedAnswerReceivedListener] ✅ Created post draft ${draft.id} for agent ${agentId}`);
          } catch (error: any) {
            console.error(`[AgentFeedAnswerReceivedListener] ❌ Error creating post draft:`, error.message);
            // Continue with other drafts
          }
        }
      }

      // Process comments
      if (response.comments && Array.isArray(response.comments)) {
        for (const comment of response.comments) {
          try {
            const draft = await draftHandler.createCommentDraft({
              agentId,
              ownerUserId,
              postId: comment.postId,
              content: comment.content,
              metadata: {
                suggestedBy: 'ai_gateway',
                context: `From feed scan ${scanId}`,
              },
            });

            // Publish draft created event
            await new AgentDraftCommentCreatedPublisher(kafkaWrapper.producer).publish({
              draftId: draft.id,
              agentId,
              ownerUserId,
              postId: draft.postId,
              content: draft.content,
              status: 'pending',
              expiresAt: draft.expiresAt.toISOString(),
              metadata: {
                scanId,
                suggestedBy: 'activity_worker', // Note: This should be 'ai_gateway' but event interface uses 'activity_worker'
              },
              timestamp: new Date().toISOString(),
            });

            createdDrafts.push({ type: 'comment', draftId: draft.id });
            console.log(`[AgentFeedAnswerReceivedListener] ✅ Created comment draft ${draft.id} for agent ${agentId}`);
          } catch (error: any) {
            console.error(`[AgentFeedAnswerReceivedListener] ❌ Error creating comment draft:`, error.message);
            // Continue with other drafts
          }
        }
      }

      // Process reactions
      if (response.reactions && Array.isArray(response.reactions)) {
        for (const reaction of response.reactions) {
          try {
            const targetType = reaction.postId ? 'post' : 'comment';
            const targetId = reaction.postId || reaction.commentId;

            if (!targetId) {
              console.warn(`[AgentFeedAnswerReceivedListener] Skipping reaction without postId or commentId`);
              continue;
            }

            const draft = await draftHandler.createReactionDraft({
              agentId,
              ownerUserId,
              targetType,
              targetId,
              reactionType: reaction.type,
              metadata: {
                suggestedBy: 'ai_gateway',
                context: `From feed scan ${scanId}`,
              },
            });

            // Publish draft created event
            await new AgentDraftReactionCreatedPublisher(kafkaWrapper.producer).publish({
              draftId: draft.id,
              agentId,
              ownerUserId,
              postId: reaction.postId,
              commentId: reaction.commentId,
              type: draft.reactionType,
              status: 'pending',
              expiresAt: draft.expiresAt.toISOString(),
              metadata: {
                scanId,
                suggestedBy: 'activity_worker', // Note: This should be 'ai_gateway' but event interface uses 'activity_worker'
              },
              timestamp: new Date().toISOString(),
            });

            createdDrafts.push({ type: 'reaction', draftId: draft.id });
            console.log(`[AgentFeedAnswerReceivedListener] ✅ Created reaction draft ${draft.id} for agent ${agentId}`);
          } catch (error: any) {
            console.error(`[AgentFeedAnswerReceivedListener] ❌ Error creating reaction draft:`, error.message);
            // Continue with other drafts
          }
        }
      }

      // Process connection requests
      if (response.connectionRequests && Array.isArray(response.connectionRequests)) {
        for (const request of response.connectionRequests) {
          try {
            const draftId = uuidv4();
            // TODO: Create AgentDraftConnectionRequest model and handler
            // For now, we'll just publish the event
            // The connection request draft model needs to be created first

            // Publish draft created event
            await new AgentDraftConnectionRequestCreatedPublisher(kafkaWrapper.producer).publish({
              draftId,
              agentId,
              ownerUserId,
              targetUserId: request.userId,
              message: request.message,
              status: 'pending',
              expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
              metadata: {
                scanId,
                suggestedBy: 'activity_worker', // Note: This should be 'ai_gateway' but event interface uses 'activity_worker'
              },
              timestamp: new Date().toISOString(),
            });

            createdDrafts.push({ type: 'connection_request', draftId });
            console.log(`[AgentFeedAnswerReceivedListener] ✅ Created connection request draft ${draftId} for agent ${agentId}`);
          } catch (error: any) {
            console.error(`[AgentFeedAnswerReceivedListener] ❌ Error creating connection request draft:`, error.message);
            // Continue with other drafts
          }
        }
      }

      console.log(`[AgentFeedAnswerReceivedListener] ✅ Completed processing feed answer for agent ${agentId}: created ${createdDrafts.length} drafts (scanId: ${scanId})`);

      await this.ack();
    } catch (error: any) {
      console.error(`[AgentFeedAnswerReceivedListener] ❌ Error processing feed answer for agent ${agentId}:`, {
        error: error.message,
        stack: error.stack,
        scanId,
      });
      // Don't ack on error - let Kafka retry
      throw error;
    }
  }
}

