import mongoose from 'mongoose';

export type SubscriptionTierName = 'free' | 'basic' | 'pro' | 'enterprise';
export type CapBehavior = 'hard' | 'soft' | 'budget';

export interface SubscriptionTierAttrs {
  tierName: SubscriptionTierName;
  dailyMessageLimit?: number | null;
  dailyTokenLimit?: number | null;
  dailyCostCapMicros?: number | null;
  capBehavior?: CapBehavior;
}

export interface SubscriptionTierDoc extends mongoose.Document {
  tierName: SubscriptionTierName;
  dailyMessageLimit: number | null;
  dailyTokenLimit: number | null;
  dailyCostCapMicros: number | null;
  capBehavior: CapBehavior;
  createdAt: Date;
  updatedAt: Date;
}

interface SubscriptionTierModel extends mongoose.Model<SubscriptionTierDoc> {
  build(attrs: SubscriptionTierAttrs): SubscriptionTierDoc;
  findByTierName(tierName: SubscriptionTierName): Promise<SubscriptionTierDoc | null>;
}

const subscriptionTierSchema = new mongoose.Schema(
  {
    tierName: { type: String, required: true, index: true, unique: true },
    dailyMessageLimit: { type: Number, default: null },
    dailyTokenLimit: { type: Number, default: null },
    dailyCostCapMicros: { type: Number, default: null },
    capBehavior: { type: String, default: 'hard' },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: any) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
      },
    },
  }
);

subscriptionTierSchema.statics.build = (attrs: SubscriptionTierAttrs) => {
  return new SubscriptionTier({
    ...attrs,
    tierName: attrs.tierName.toLowerCase(),
  });
};

subscriptionTierSchema.statics.findByTierName = async function (tierName: SubscriptionTierName) {
  return this.findOne({ tierName: tierName.toLowerCase() });
};

export const SubscriptionTier = mongoose.model<SubscriptionTierDoc, SubscriptionTierModel>(
  'SubscriptionTier',
  subscriptionTierSchema
);



