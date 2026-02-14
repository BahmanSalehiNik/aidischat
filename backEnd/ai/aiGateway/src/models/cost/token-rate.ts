import mongoose from 'mongoose';

export interface TokenRateAttrs {
  provider: string;
  modelName: string;
  /**
   * Price per 1,000,000 input tokens, stored in USD micros (1 USD = 1,000,000 micros).
   * Example: $30 / 1M tokens => 30_000_000 micros.
   */
  inputCostPerMillionMicros: number;
  /**
   * Price per 1,000,000 output tokens, stored in USD micros.
   */
  outputCostPerMillionMicros: number;
  currency?: string;
  effectiveDate?: Date;
}

export interface TokenRateDoc extends mongoose.Document {
  provider: string;
  modelName: string;
  inputCostPerMillionMicros: number;
  outputCostPerMillionMicros: number;
  currency: string;
  effectiveDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface TokenRateModel extends mongoose.Model<TokenRateDoc> {
  build(attrs: TokenRateAttrs): TokenRateDoc;
  findEffectiveRate(provider: string, modelName: string, effectiveAt?: Date): Promise<TokenRateDoc | null>;
}

const tokenRateSchema = new mongoose.Schema(
  {
    provider: { type: String, required: true, index: true },
    modelName: { type: String, required: true, index: true },
    inputCostPerMillionMicros: { type: Number, required: true },
    outputCostPerMillionMicros: { type: Number, required: true },
    currency: { type: String, default: 'USD' },
    effectiveDate: { type: Date, default: () => new Date() },
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

// Multiple rates per (provider, modelName) over time; pick the latest rate whose effectiveDate <= usage timestamp.
tokenRateSchema.index({ provider: 1, modelName: 1, effectiveDate: 1 }, { unique: true });

tokenRateSchema.statics.build = (attrs: TokenRateAttrs) => {
  return new TokenRate(attrs);
};

tokenRateSchema.statics.findEffectiveRate = async function (
  provider: string,
  modelName: string,
  effectiveAt?: Date
) {
  const providerLower = provider.toLowerCase();
  const at = effectiveAt ?? new Date();

  return this.findOne({
    provider: providerLower,
    modelName,
    effectiveDate: { $lte: at },
  }).sort({ effectiveDate: -1 });
};

export const TokenRate = mongoose.model<TokenRateDoc, TokenRateModel>('TokenRate', tokenRateSchema);



