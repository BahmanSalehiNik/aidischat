/**
 * Storage container names - must match backend StorageContainer enum
 * These are the allowed container names for media uploads
 */
export const StorageContainers = {
  Posts: 'posts',
  Profile: 'profile-images',
  Chat: 'chat-media',
  General: 'media',
} as const;

export type StorageContainer = typeof StorageContainers[keyof typeof StorageContainers];

