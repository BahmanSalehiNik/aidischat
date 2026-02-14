import mongoose from 'mongoose';

export type CostAlertSeverity = 'info' | 'warning' | 'critical';
export type CostAlertMetric = 'daily_cost' | 'daily_tokens' | 'daily_messages';

export interface CostAlertAttrs {
  ownerUserId: string;
  day: string; // YYYY-MM-DD (UTC)
  metric: CostAlertMetric;
  threshold: number; // e.g. 0.8, 0.9, 1.0
  severity: CostAlertSeverity;
  currentValue: number;
  limitValue: number;
  message: string;
  acknowledged?: boolean;
}

export interface CostAlertDoc extends mongoose.Document {
  ownerUserId: string;
  day: string;
  metric: CostAlertMetric;
  threshold: number;
  severity: CostAlertSeverity;
  currentValue: number;
  limitValue: number;
  message: string;
  acknowledged: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface CostAlertModel extends mongoose.Model<CostAlertDoc> {
  build(attrs: CostAlertAttrs): CostAlertDoc;
}

const costAlertSchema = new mongoose.Schema(
  {
    ownerUserId: { type: String, required: true, index: true },
    day: { type: String, required: true, index: true },
    metric: { type: String, required: true, index: true },
    threshold: { type: Number, required: true },
    severity: { type: String, required: true },
    currentValue: { type: Number, required: true },
    limitValue: { type: Number, required: true },
    message: { type: String, required: true },
    acknowledged: { type: Boolean, default: false },
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

// Prevent duplicate notifications for the same threshold within a day.
costAlertSchema.index({ ownerUserId: 1, day: 1, metric: 1, threshold: 1 }, { unique: true });

costAlertSchema.statics.build = (attrs: CostAlertAttrs) => {
  return new CostAlert(attrs);
};

export const CostAlert = mongoose.model<CostAlertDoc, CostAlertModel>('CostAlert', costAlertSchema);


