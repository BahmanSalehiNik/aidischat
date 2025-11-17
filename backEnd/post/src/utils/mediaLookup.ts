/**
 * Utility functions for looking up media for posts
 * Handles cache lookup, document fallback, and retry logic
 */
import { Post, PostDoc } from '../models/post';
import { mediaCache } from './mediaCache';

export interface MediaItem {
  id: string;
  url: string;
  type: string;
}

/**
 * Get media for a post, checking cache first, then document, then retrying cache
 * @param post - The post document (can be before or after save)
 * @param options - Options for media lookup
 * @returns Valid media array or undefined
 */
export async function getPostMedia(
  post: PostDoc,
  options: {
    checkDocument?: boolean; // Check document after save (for create flow)
    updateDocument?: boolean; // Update document if media found on retry
  } = {}
): Promise<MediaItem[] | undefined> {
  const { checkDocument = false, updateDocument = false } = options;

  // If no mediaIds, return undefined
  if (!post.mediaIds || post.mediaIds.length === 0) {
    return undefined;
  }

  // Step 1: Try cache first
  const mediaIdStrings = post.mediaIds.map((id: any) => String(id));
  let media = mediaCache.getMany(mediaIdStrings);

  // Filter out fallback media (where url === id, meaning not in cache)
  let validMedia = media ? media.filter(m => m.url !== m.id) : undefined;

  // If we found valid media in cache, return it
  if (validMedia && validMedia.length > 0) {
    return validMedia;
  }

  // Step 2: If cache doesn't have media, check document (for existing posts or after save)
  if (checkDocument) {
    // Reload post to get any media that might have been stored
    const savedPost = await Post.findById(post.id);
    if (savedPost?.media && Array.isArray(savedPost.media) && savedPost.media.length > 0) {
      console.log('Found media in document after save:', savedPost.media.length, 'items');
      return savedPost.media;
    }
  } else if (post.media && Array.isArray(post.media) && post.media.length > 0) {
    // Use existing media from document (for update flow)
    console.log('Using existing media from document:', post.media.length, 'items');
    return post.media;
  }

  // Step 3: Retry cache (in case MediaCreated event arrived between checks)
  const retryMedia = mediaCache.getMany(mediaIdStrings);
  const retryValidMedia = retryMedia ? retryMedia.filter(m => m.url !== m.id) : undefined;
  
  if (retryValidMedia && retryValidMedia.length > 0) {
    console.log('Found media in cache on retry:', retryValidMedia.length, 'items');
    
    // Optionally update document with found media
    if (updateDocument) {
      const postToUpdate = await Post.findById(post.id);
      if (postToUpdate) {
        postToUpdate.media = retryValidMedia;
        await postToUpdate.save();
      }
    }
    
    return retryValidMedia;
  }

  // No media found
  console.log('Warning: Post has mediaIds but no media found in cache or document');
  return undefined;
}

/**
 * Get and store media for a post
 * This function gets media and stores it in the post document
 * @param post - The post document
 * @returns Valid media array or undefined
 */
export async function getAndStorePostMedia(post: PostDoc): Promise<MediaItem[] | undefined> {
  const media = await getPostMedia(post, {
    checkDocument: false, // Don't check document for create flow (will be checked after save)
    updateDocument: false,
  });

  // Store media in post document if found
  if (media && media.length > 0) {
    post.media = media;
  }

  return media;
}

