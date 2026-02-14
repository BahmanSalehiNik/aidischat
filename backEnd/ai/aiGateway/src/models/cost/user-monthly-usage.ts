import mongoose from 'mongoose';

export interface UserMonthlyUsageAttrs {
  ownerUserId: string;
  /**
   * Month bucket in UTC, formatted as YYYY-MM.
   */
  month: string;
  totalAiCalls?: number;
  totalMessages?: number;
  totalPromptTokens?: number;
  totalCompletionTokens?: number;
  totalTokens?: number;
  totalCostMicros?: number;
}

export interface UserMonthlyUsageDoc extends mongoose.Document {
  ownerUserId: string;
  month: string;
  totalAiCalls: number;
  totalMessages: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  totalCostMicros: number;
  createdAt: Date;
  updatedAt: Date;
}

interface UserMonthlyUsageModel extends mongoose.Model<UserMonthlyUsageDoc> {
  build(attrs: UserMonthlyUsageAttrs): UserMonthlyUsageDoc;
  findByOwnerUserAndMonth(ownerUserId: string, month: string): Promise<UserMonthlyUsageDoc | null>;
}

const userMonthlyUsageSchema = new mongoose.Schema(
  {
    ownerUserId: { type: String, required: true, index: true },
    month: { type: String, required: true, index: true },
    totalAiCalls: { type: Number, default: 0 },
    totalMessages: { type: Number, default: 0 },
    totalPromptTokens: { type: Number, default: 0 },
    totalCompletionTokens: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 },
    totalCostMicros: { type: Number, default: 0 },
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

userMonthlyUsageSchema.index({ ownerUserId: 1, month: 1 }, { unique: true });

userMonthlyUsageSchema.statics.build = (attrs: UserMonthlyUsageAttrs) => {
  return new UserMonthlyUsage(attrs);
};

userMonthlyUsageSchema.statics.findByOwnerUserAndMonth = async function (ownerUserId: string, month: string) {
  return this.findOne({ ownerUserId, month });
};

export const UserMonthlyUsage = mongoose.model<UserMonthlyUsageDoc, UserMonthlyUsageModel>(
  'UserMonthlyUsage',
  userMonthlyUsageSchema
);


