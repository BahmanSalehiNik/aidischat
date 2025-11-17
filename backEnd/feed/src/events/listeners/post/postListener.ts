import { Subjects, PostCreatedEvent, PostUpdatedEvent, PostDeletedEvent, Visibility, Listener, NotFoundError } from '@aichatwar/shared';
import { fanoutQueue } from '../../../queues/fanout-queue';
import { Post } from '../../../models/post/post';
import { GroupIdPostCreated, GroupIdPostUpdated, GroupIdPostDeleted } from './../../queGroupNames';
import { EachMessagePayload } from 'kafkajs';

export class PostCreatedListener extends Listener<PostCreatedEvent> {
  readonly topic: Subjects.PostCreated = Subjects.PostCreated;
  readonly groupId = GroupIdPostCreated;

  async onMessage(data: PostCreatedEvent['data'], msg: EachMessagePayload) {
    console.log('Post created event received:', data);
    const {
      id,
      userId,
      content,
      mediaIds,
      media,
      visibility,
      createdAt,
    } = data;

    // Use media from event if available, otherwise fallback to mediaIds
    // Media from event contains id and url (unsigned) as published by media service
    let postMedia: { id: string; url: string; type: string }[] | undefined = undefined;
    if (media && media.length > 0) {
      // Use media from the event (contains id and url from media service)
      console.log('Using media from event:', media);
      // Filter out invalid media (where url === id, meaning it's just a placeholder)
      const validMedia = media.filter((m: any) => {
        const hasValidUrl = m.url && m.url !== m.id && m.url !== '';
        if (!hasValidUrl) {
          console.log('Filtering out invalid media item (url === id or empty):', m);
        }
        return hasValidUrl;
      });
      
      if (validMedia.length > 0) {
        // Ensure all media items have id field (for backward compatibility)
        postMedia = validMedia.map((m: any) => ({
          id: m.id || m.url || '', // Use id if available, fallback to url or empty string
          url: m.url,
          type: m.type || 'image',
        }));
      } else {
        console.log('No valid media items after filtering');
        // Don't set postMedia to invalid placeholder - keep it undefined
        // The post will be updated later when valid media is available
      }
    } else if (mediaIds && mediaIds.length > 0) {
      // Don't create placeholder media objects - wait for valid media from PostUpdatedEvent
      // This prevents posts from having invalid media URLs
      console.log('MediaIds present but no media in event - will wait for PostUpdatedEvent with valid media');
      postMedia = undefined;
    } else {
      console.log('No media or mediaIds in event');
    }

    console.log('Post media to save:', postMedia);

    const post = Post.build({
      id,
      userId,
      content,
      media: postMedia,
      visibility: Visibility[visibility as keyof typeof Visibility],
      originalCreation: createdAt
    });

    await post.save();
    console.log('Post saved with media:', post.media);

    // Enqueue fan-out job
    await fanoutQueue.add('fanout-job', { postId: id, authorId: userId, visibility });
    
    // Manual acknowledgment - only after successful save and queue job
    await this.ack();
  }
}

export class PostUpdatedListener extends Listener<PostUpdatedEvent> {
  readonly topic: Subjects.PostUpdated = Subjects.PostUpdated;
  readonly groupId = GroupIdPostUpdated;

  async onMessage(data: PostUpdatedEvent['data'], msg: EachMessagePayload) {
    console.log('Post updated event received:', data);
    const {
      id,
      content,
      mediaIds,
      media,
      visibility,
      updatedAt,
    } = data;

    // Find the post in feed service
    const post = await Post.findOne({ _id: id });
    if (!post) {
      console.log(`Post ${id} not found in feed service`);
      await this.ack();
      return;
    }

    // Use media from event if available, otherwise keep existing media
    // Media from event contains id and url (unsigned) as published by media service
    let postMedia: { id: string; url: string; type: string }[] | undefined = undefined;
    if (media && media.length > 0) {
      // Filter out invalid media (where url === id, meaning it's just a placeholder)
      const validMedia = media.filter((m: any) => {
        const hasValidUrl = m.url && m.url !== m.id && m.url !== '';
        if (!hasValidUrl) {
          console.log('Filtering out invalid media item in update (url === id or empty):', m);
        }
        return hasValidUrl;
      });
      
      if (validMedia.length > 0) {
        // Ensure all media items have id field (for backward compatibility)
        postMedia = validMedia.map((m: any) => ({
          id: m.id || m.url || '', // Use id if available, fallback to url or empty string
          url: m.url,
          type: m.type || 'image',
        }));
      } else {
        console.log('No valid media items in update event - keeping existing media');
        // Keep existing media if update doesn't have valid media
        postMedia = post.media;
      }
    } else if (mediaIds && mediaIds.length > 0) {
      // If mediaIds are present but no media, keep existing media (don't overwrite with invalid data)
      console.log('MediaIds present but no media in update event - keeping existing media');
      postMedia = post.media;
    } else {
      // No mediaIds means media was removed - clear it
      postMedia = undefined;
    }

    // Update post data
    post.content = content;
    post.media = postMedia;
    post.visibility = visibility as any;
    post.updatedAt = new Date(updatedAt);

    await post.save();

    console.log(`Updated post ${id} in feed service`);
    
    // Manual acknowledgment - only after successful save
    await this.ack();
  }
}

export class PostDeletedListener extends Listener<PostDeletedEvent> {
  readonly topic: Subjects.PostDeleted = Subjects.PostDeleted;
  readonly groupId = GroupIdPostDeleted;

  async onMessage(data: PostDeletedEvent['data'], msg: EachMessagePayload) {
    console.log('Post deleted event received:', data);
    const { id } = data;

    // Find and delete the post from feed service
    const post = await Post.findOne({ _id: id });
    if (!post) {
      console.log(`Post ${id} not found in feed service`);
      await this.ack();
      return;
    }

    await Post.deleteOne({ _id: id });

    console.log(`Deleted post ${id} from feed service`);
    
    // Manual acknowledgment - only after successful deletion
    await this.ack();
  }
}