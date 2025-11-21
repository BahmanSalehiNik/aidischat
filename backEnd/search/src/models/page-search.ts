import mongoose from 'mongoose';

interface PageSearchAttrs {
  pageId: string;
  name: string;
  description?: string;
  category?: string;
  avatarUrl?: string;
}

export interface PageSearchDoc extends mongoose.Document, PageSearchAttrs {}

interface PageSearchModel extends mongoose.Model<PageSearchDoc> {
  build(attrs: PageSearchAttrs): PageSearchDoc;
}

const pageSearchSchema = new mongoose.Schema(
  {
    pageId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: String,
    category: String,
    avatarUrl: String,
  },
  { timestamps: true }
);

pageSearchSchema.index({ name: 'text', description: 'text', category: 'text' });

pageSearchSchema.statics.build = (attrs: PageSearchAttrs) => new PageSearch(attrs);

const PageSearch = mongoose.model<PageSearchDoc, PageSearchModel>('PageSearch', pageSearchSchema);

export { PageSearch };

