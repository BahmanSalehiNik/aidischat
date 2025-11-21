import {
  Listener,
  Subjects,
  PostCreatedEvent,
  PostUpdatedEvent,
  PostDeletedEvent,
  Visibility,
} from '@aichatwar/shared';
import { EachMessagePayload } from 'kafkajs';
import { PostAuthorStatus } from '../../../models/post-author-status';
import { UserStatus } from '../../../models/user-status';
import { PostSearch } from '../../../models/post-search';

class PostCreatedListener extends Listener<PostCreatedEvent> {
  readonly topic: Subjects.PostCreated = Subjects.PostCreated;
  groupId = 'search-post-created';

  async onMessage(processedMessage: PostCreatedEvent['data'], msg: EachMessagePayload) {
    console.log('[Search] Post created event received:', processedMessage.id);
    const authorId = processedMessage.userId;

    // Check author status
    const authorStatus = await UserStatus.findOne({ userId: authorId }).lean();
    const isAuthorDeleted = authorStatus?.isDeleted || false;
    const isAuthorBlocked = false; // Will be updated by block events

    // Store post author status
    await PostAuthorStatus.updateOne(
      { postId: processedMessage.id },
      {
        $set: {
          postId: processedMessage.id,
          authorId,
          isAuthorDeleted,
          isAuthorBlocked,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    // Only index public posts for search (standard approach)
    // Private and friends-only posts are not searchable
    const visibilityStr = String(processedMessage.visibility).toLowerCase();
    const isPublic = processedMessage.visibility === Visibility.Public || visibilityStr === 'public';
    
    if (isPublic) {
      // Get first media URL for preview (if available)
      let mediaPreviewUrl: string | undefined;
      if (processedMessage.media && Array.isArray(processedMessage.media) && processedMessage.media.length > 0) {
        const firstMedia = processedMessage.media[0];
        if (firstMedia?.url && firstMedia.url !== firstMedia.id) {
          mediaPreviewUrl = firstMedia.url;
        }
      }

      // Extract tags from content (simple approach - could be enhanced)
      // For now, we'll use empty tags array - can be enhanced later with hashtag extraction
      const tags: string[] = [];

      // Create PostSearch document for search indexing
      await PostSearch.updateOne(
        { postId: processedMessage.id },
        {
          $set: {
            postId: processedMessage.id,
            authorId,
            caption: processedMessage.content || '',
            tags,
            mediaPreviewUrl,
          },
        },
        { upsert: true }
      );
      
      console.log('[Search] PostSearch created for postId:', processedMessage.id);
    } else {
      console.log('[Search] Post not indexed (visibility:', processedMessage.visibility, ')');
    }

    await this.ack();
  }
}

class PostUpdatedListener extends Listener<PostUpdatedEvent> {
  readonly topic: Subjects.PostUpdated = Subjects.PostUpdated;
  groupId = 'search-post-updated';

  async onMessage(processedMessage: PostUpdatedEvent['data'], msg: EachMessagePayload) {
    console.log('[Search] Post updated event received:', processedMessage.id);
    
    // If post becomes public, index it; if it becomes private, remove it
    const visibilityStr = String(processedMessage.visibility).toLowerCase();
    const isPublic = processedMessage.visibility === Visibility.Public || visibilityStr === 'public';
    
    if (isPublic) {
      // Get first media URL for preview (if available)
      let mediaPreviewUrl: string | undefined;
      if (processedMessage.media && Array.isArray(processedMessage.media) && processedMessage.media.length > 0) {
        const firstMedia = processedMessage.media[0];
        if (firstMedia?.url && firstMedia.url !== firstMedia.id) {
          mediaPreviewUrl = firstMedia.url;
        }
      }

      await PostSearch.updateOne(
        { postId: processedMessage.id },
        {
          $set: {
            postId: processedMessage.id,
            authorId: processedMessage.userId,
            caption: processedMessage.content || '',
            mediaPreviewUrl,
          },
        },
        { upsert: true }
      );
      
      console.log('[Search] PostSearch updated for postId:', processedMessage.id);
    } else {
      // Remove from search index if post becomes private
      await PostSearch.deleteOne({ postId: processedMessage.id });
      console.log('[Search] PostSearch removed for postId (now private):', processedMessage.id);
    }

    await this.ack();
  }
}

class PostDeletedListener extends Listener<PostDeletedEvent> {
  readonly topic: Subjects.PostDeleted = Subjects.PostDeleted;
  groupId = 'search-post-deleted';

  async onMessage(processedMessage: PostDeletedEvent['data'], msg: EachMessagePayload) {
    console.log('[Search] Post deleted event received:', processedMessage.id);
    
    // Remove from search index
    await PostSearch.deleteOne({ postId: processedMessage.id });
    console.log('[Search] PostSearch deleted for postId:', processedMessage.id);

    await this.ack();
  }
}

// Update post author status when user is deleted/blocked
class PostAuthorStatusUpdater {
  static async updatePostsForUser(userId: string, isDeleted: boolean, isBlocked: boolean) {
    await PostAuthorStatus.updateMany(
      { authorId: userId },
      {
        $set: {
          isAuthorDeleted: isDeleted,
          isAuthorBlocked: isBlocked,
          updatedAt: new Date(),
        },
      }
    );
  }
}

export {
  PostCreatedListener,
  PostUpdatedListener,
  PostDeletedListener,
  PostAuthorStatusUpdater,
};

