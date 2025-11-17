// src/models/media.ts
import mongoose, { Types } from 'mongoose';

export enum MediaType {
  Image = 'image',
  Video = 'video',
}

export enum StorageProvider {
  AWS = 'aws',
  GCP = 'gcp',
  AZURE = 'azure',
  MINIO = 'minio',
}

export enum StorageContainer {
  Posts = 'posts',
  Profile = 'profile-images',
  Chat = 'chat-media',
  General = 'media',
}

interface DummyRet {
    _id: Types.ObjectId | undefined;
    id?: Types.ObjectId | undefined;
    __v: number | undefined;
}

// ----- ATTRIBUTES REQUIRED TO CREATE A MEDIA -----
export interface MediaAttrs {
  userId: string;
  provider: StorageProvider;
  bucket: string;
  key: string;
  url: string;
  type: MediaType;
  size: number;
  relatedResource?: {
    type: string;
    id: string;
  };
}

// ----- MEDIA DOCUMENT -----
export interface MediaDoc extends mongoose.Document {
  userId: string;
  provider: StorageProvider;
  bucket: string;
  key: string;
  url: string;
  type: MediaType;
  size: number;
  relatedResource?: {
    type: string;
    id: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

// ----- MEDIA MODEL -----
export interface MediaModel extends mongoose.Model<MediaDoc> {
  build(attrs: MediaAttrs): MediaDoc;
  getMediaUrlsByIds(mediaIds: string[]): Promise<Array<{ url: string; type: string }>>;
}

// ----- SCHEMA -----
const mediaSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    provider: { type: String, enum: Object.values(StorageProvider), required: true },
    bucket: { type: String, required: true },
    key: { type: String, required: true },
    url: { type: String, required: true },
    type: { type: String, enum: Object.values(MediaType), required: true },
    size: { type: Number, required: true },
    relatedResource: {
      type: {
        type: String,
      },
      id: {
        type: String,
      },
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret: DummyRet) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
      },
    },
  }
);

// ----- EXPORT MODEL -----
const Media = mongoose.model<MediaDoc, MediaModel>('Media', mediaSchema);

// ----- STATIC BUILD METHOD -----
mediaSchema.statics.build = (attrs: MediaAttrs) => {
  return new Media(attrs);
};

// ----- STATIC METHOD: Get media URLs by IDs -----
mediaSchema.statics.getMediaUrlsByIds = async function(mediaIds: string[]): Promise<Array<{ url: string; type: string }>> {
  if (!mediaIds || mediaIds.length === 0) {
    return [];
  }

  try {
    // Convert string IDs to ObjectIds for MongoDB query
    const objectIds = mediaIds.map(id => {
      try {
        return new mongoose.Types.ObjectId(id);
      } catch {
        return null;
      }
    }).filter(Boolean) as mongoose.Types.ObjectId[];

    if (objectIds.length === 0) {
      // If no valid ObjectIds, return fallback
      return mediaIds.map((mediaId: string) => ({
        url: mediaId,
        type: 'image',
      }));
    }

    // Query using the Media model (now defined above)
    const mediaDocs = await Media.find({ _id: { $in: objectIds } }).lean();

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
};

export { Media };
