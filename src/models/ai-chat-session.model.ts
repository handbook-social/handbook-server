import { Document, Schema, model, models, Types } from 'mongoose';

export interface IAIChatSessionModel extends Document {
    _id: string;
    userId: Types.ObjectId;
    title: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface IAIChatSessionInput {
    userId: string | Types.ObjectId;
    title: string;
}

export interface IAIChatSessionOutput {
    _id: string;
    userId: string | Types.ObjectId;
    title: string;
    createdAt: Date;
    updatedAt: Date;
}

export const AIChatSessionSchema = new Schema<IAIChatSessionModel>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        title: { type: String, required: true, default: 'New Chat' },
    },
    { timestamps: true }
);

AIChatSessionSchema.index({ userId: 1 });
AIChatSessionSchema.index({ updatedAt: -1 });

const AIChatSession =
    models.AIChatSession || model<IAIChatSessionModel>('AIChatSession', AIChatSessionSchema);

export default AIChatSession;
