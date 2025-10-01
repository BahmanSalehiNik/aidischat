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

// ----- STATIC BUILD METHOD -----
mediaSchema.statics.build = (attrs: MediaAttrs) => {
  return new Media(attrs);
};

// ----- EXPORT MODEL -----
const Media = mongoose.model<MediaDoc, MediaModel>('Media', mediaSchema);

export { Media };
