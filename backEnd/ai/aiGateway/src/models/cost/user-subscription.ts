import mongoose from 'mongoose';
import type { SubscriptionTierName } from './subscription-tier';

export interface UserSubscriptionAttrs {
  ownerUserId: string;
  tierName: SubscriptionTierName;
  // Optional per-user overrides (micros)
  dailyCostCapMicros?: number | null;
  dailyMessageLimit?: number | null;
  dailyTokenLimit?: number | null;
}

export interface UserSubscriptionDoc extends mongoose.Document {
  ownerUserId: string;
  tierName: SubscriptionTierName;
  dailyCostCapMicros: number | null;
  dailyMessageLimit: number | null;
  dailyTokenLimit: number | null;
  createdAt: Date;
  updatedAt: Date;
}

interface UserSubscriptionModel extends mongoose.Model<UserSubscriptionDoc> {
  build(attrs: UserSubscriptionAttrs): UserSubscriptionDoc;
  findByOwnerUserId(ownerUserId: string): Promise<UserSubscriptionDoc | null>;
}

const userSubscriptionSchema = new mongoose.Schema(
  {
    ownerUserId: { type: String, required: true, unique: true, index: true },
    tierName: { type: String, required: true, index: true },
    dailyCostCapMicros: { type: Number, default: null },
    dailyMessageLimit: { type: Number, default: null },
    dailyTokenLimit: { type: Number, default: null },
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

userSubscriptionSchema.statics.build = (attrs: UserSubscriptionAttrs) => {
  return new UserSubscription({
    ...attrs,
    tierName: attrs.tierName.toLowerCase(),
  });
};

userSubscriptionSchema.statics.findByOwnerUserId = async function (ownerUserId: string) {
  return this.findOne({ ownerUserId });
};

export const UserSubscription = mongoose.model<UserSubscriptionDoc, UserSubscriptionModel>(
  'UserSubscription',
  userSubscriptionSchema
);



