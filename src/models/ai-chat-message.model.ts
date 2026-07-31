import { Document, Schema, model, models, Types } from 'mongoose';

export interface IAIChatMessagePart {
    text: string;
}

export interface IAIChatMessageModel extends Document {
    _id: string;
    sessionId: Types.ObjectId;
    role: 'user' | 'model';
    parts: IAIChatMessagePart[];
    createdAt: Date;
}

export interface IAIChatMessageInput {
    sessionId: string | Types.ObjectId;
    role: 'user' | 'model';
    parts: IAIChatMessagePart[];
}

export const AIChatMessageSchema = new Schema<IAIChatMessageModel>(
    {
        sessionId: { type: Schema.Types.ObjectId, ref: 'AIChatSession', required: true },
        role: { type: String, enum: ['user', 'model'], required: true },
        parts: [
            {
                text: { type: String, required: true },
            },
        ],
    },
    { timestamps: { createdAt: true, updatedAt: false } }
);

AIChatMessageSchema.index({ sessionId: 1 });
AIChatMessageSchema.index({ createdAt: 1 });

const AIChatMessage =
    models.AIChatMessage || model<IAIChatMessageModel>('AIChatMessage', AIChatMessageSchema);

export default AIChatMessage;
