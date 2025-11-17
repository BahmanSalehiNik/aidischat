import mongoose from 'mongoose';

/**
 * Fetches media URLs by media IDs from the media collection
 * This utility function can be reused across the post service
 * 
 * @param mediaIds - Array of media IDs (strings)
 * @returns Promise resolving to array of media objects with url and type
 */
export async function getMediaUrlsByIds(
  mediaIds: string[]
): Promise<Array<{ url: string; type: string }>> {
  if (!mediaIds || mediaIds.length === 0) {
    return [];
  }

  try {
    // Query media collection directly from MongoDB
    const mediaCollection = mongoose.connection.db?.collection('media');
    if (!mediaCollection) {
      // Fallback: convert mediaIds to media objects
      return mediaIds.map((mediaId: string) => ({
        url: mediaId,
        type: 'image',
      }));
    }

    // Convert string IDs to ObjectIds for MongoDB query
    const objectIds = mediaIds
      .map((id) => {
        try {
          return new mongoose.Types.ObjectId(id);
        } catch {
          return null;
        }
      })
      .filter(Boolean) as mongoose.Types.ObjectId[];

    if (objectIds.length === 0) {
      // If no valid ObjectIds, return fallback
      return mediaIds.map((mediaId: string) => ({
        url: mediaId,
        type: 'image',
      }));
    }

    // Query using MongoDB collection
    const mediaDocs = await mediaCollection.find({ _id: { $in: objectIds } }).toArray();

    // Map mediaIds to media objects, preserving order
    return mediaIds.map((mediaId: string) => {
      const mediaDoc = mediaDocs.find((doc: any) => doc._id?.toString() === mediaId);
      if (mediaDoc) {
        return {
          url: mediaDoc.url || mediaId,
          type: mediaDoc.type || 'image',
        };
      }
      // Fallback if media not found
      return {
        url: mediaId,
        type: 'image',
      };
    });
  } catch (error) {
    console.error('Error fetching media URLs by IDs:', error);
    // Fallback: convert mediaIds to media objects
    return mediaIds.map((mediaId: string) => ({
      url: mediaId,
      type: 'image',
    }));
  }
}

