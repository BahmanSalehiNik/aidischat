import mongoose from "mongoose";

export type FeedbackType = 'explicit' | 'implicit' | 'reaction';
export type FeedbackSource = 'chat' | 'post' | 'comment' | 'profile';

interface FeedbackAttrs {
    feedbackType: FeedbackType;
    source: FeedbackSource;
    sourceId: string;
    agentId: string;
    userId: string;
    roomId?: string;
    value: number;
    metadata?: Record<string, any>;
}

export interface FeedbackDoc extends mongoose.Document {
    feedbackType: FeedbackType;
    source: FeedbackSource;
    sourceId: string;
    agentId: string;
    userId: string;
    roomId?: string;
    value: number;
    metadata?: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}

interface FeedbackModel extends mongoose.Model<FeedbackDoc> {
    build(attrs: FeedbackAttrs): FeedbackDoc;
}

const feedbackSchema = new mongoose.Schema<FeedbackDoc, FeedbackModel>({
    feedbackType: {
        type: String,
        enum: ['explicit', 'implicit', 'reaction'],
        required: true
    },
    source: {
        type: String,
        enum: ['chat', 'post', 'comment', 'profile'],
        required: true
    },
    sourceId: {
        type: String,
        required: true
    },
    agentId: {
        type: String,
        required: true,
        index: true
    },
    userId: {
        type: String,
        required: true,
        index: true
    },
    roomId: {
        type: String
    },
    value: {
        type: Number,
        required: true,
        min: -1,
        max: 1
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed
    }
}, {
    timestamps: true,
    versionKey: false,
    toJSON: {
        transform(_doc: FeedbackDoc, ret: any) {
            ret.id = ret._id;
            delete ret._id;
        }
    }
});

feedbackSchema.index({ userId: 1, agentId: 1, sourceId: 1 }, { unique: true, sparse: true });
feedbackSchema.index({ agentId: 1, createdAt: -1 });

const Feedback = mongoose.model<FeedbackDoc, FeedbackModel>('Feedback', feedbackSchema);

Feedback.build = (attrs: FeedbackAttrs) => {
    return new Feedback(attrs);
};

export { Feedback };

