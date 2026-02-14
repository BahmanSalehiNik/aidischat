import mongoose from 'mongoose';

export interface UserDailyUsageAttrs {
  ownerUserId: string;
  /**
   * Date bucket in UTC, formatted as YYYY-MM-DD.
   */
  day: string;
  totalAiCalls?: number;
  totalMessages?: number;
  totalPromptTokens?: number;
  totalCompletionTokens?: number;
  totalTokens?: number;
  totalCostMicros?: number;
}

export interface UserDailyUsageDoc extends mongoose.Document {
  ownerUserId: string;
  day: string;
  totalAiCalls: number;
  totalMessages: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  totalCostMicros: number;
  createdAt: Date;
  updatedAt: Date;
}

interface UserDailyUsageModel extends mongoose.Model<UserDailyUsageDoc> {
  build(attrs: UserDailyUsageAttrs): UserDailyUsageDoc;
  findByOwnerUserAndDay(ownerUserId: string, day: string): Promise<UserDailyUsageDoc | null>;
}

const userDailyUsageSchema = new mongoose.Schema(
  {
    ownerUserId: { type: String, required: true, index: true },
    day: { type: String, required: true, index: true },
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

userDailyUsageSchema.index({ ownerUserId: 1, day: 1 }, { unique: true });

userDailyUsageSchema.statics.build = (attrs: UserDailyUsageAttrs) => {
  return new UserDailyUsage(attrs);
};

userDailyUsageSchema.statics.findByOwnerUserAndDay = async function (ownerUserId: string, day: string) {
  return this.findOne({ ownerUserId, day });
};

export const UserDailyUsage = mongoose.model<UserDailyUsageDoc, UserDailyUsageModel>(
  'UserDailyUsage',
  userDailyUsageSchema
);



