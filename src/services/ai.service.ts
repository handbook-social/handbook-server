import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../common/config';
import {
    ServiceUnavailableError,
    ValidationError,
} from '../common/errors/app.error';
import { AIChatSession, AIChatMessage } from '../models';
import { Types } from 'mongoose';

interface AIHistoryPart {
    text: string;
}

interface AIHistoryItem {
    role: string;
    parts: AIHistoryPart[];
}

export class AIService {
    private genAI: GoogleGenerativeAI;
    private modelName: string;

    constructor() {
        const apiKey = env.AI_API_KEY;
        if (!apiKey) {
            throw new ServiceUnavailableError(
                'GOOGLE_API_KEY is not configured'
            );
        }

        if (!env.AI_MODEL) {
            throw new ServiceUnavailableError('AI_MODEL is not configured');
        }

        if (!env.AI_PROMPT) {
            throw new ServiceUnavailableError('AI_PROMPT is not configured');
        }

        this.genAI = new GoogleGenerativeAI(apiKey);
        this.modelName = env.AI_MODEL;
    }

    /**
     * Fetch conversation history formatted for Gemini SDK
     */
    public async getHistory(sessionId: string | Types.ObjectId): Promise<AIHistoryItem[]> {
        const messages = await AIChatMessage.find({ sessionId })
            .sort({ createdAt: 1 })
            .lean();

        return messages.map((msg) => ({
            role: msg.role,
            parts: msg.parts.map((p: any) => ({ text: p.text })),
        }));
    }

    /**
     * Start a chat session and return the Gemini streaming result
     */
    public async sendMessageStream(message: string, sessionId: string | Types.ObjectId) {
        if (!message || !message.trim()) {
            throw new ValidationError('Message is required');
        }

        try {
            const history = await this.getHistory(sessionId);

            const model = this.genAI.getGenerativeModel({
                model: this.modelName,
                systemInstruction: env.AI_PROMPT,
            });

            const chat = model.startChat({
                history,
            });

            const resultStream = await chat.sendMessageStream(message);
            return resultStream;
        } catch (error) {
            throw new ServiceUnavailableError(
                'Failed to start stream response from Handbook AI',
                error instanceof Error ? error.message : error
            );
        }
    }

    /**
     * Automatically summarize the session title using Gemini
     */
    public async summarizeSessionTitle(
        sessionId: string | Types.ObjectId,
        firstMessage: string
    ): Promise<string> {
        try {
            const model = this.genAI.getGenerativeModel({
                model: this.modelName,
            });

            const prompt = `Tóm tắt câu hỏi hoặc chủ đề thảo luận sau đây thành một tiêu đề hội thoại cực kỳ ngắn gọn và súc tích (chỉ từ 3 đến 5 từ tiếng Việt). Không chứa dấu ngoặc kép hay các từ ngữ thừa thãi. Nếu là tiếng Anh, hãy tóm tắt bằng tiếng Việt. Câu hỏi: "${firstMessage}"`;
            
            const result = await model.generateContent(prompt);
            const responseText = result.response.text();
            
            const title = responseText
                .trim()
                .replace(/['"“”]/g, '')
                .substring(0, 50);

            if (title) {
                await AIChatSession.findByIdAndUpdate(sessionId, { title });
                return title;
            }
        } catch (error) {
            console.error('Failed to summarize session title:', error);
        }

        const fallbackTitle = firstMessage.substring(0, 30);
        await AIChatSession.findByIdAndUpdate(sessionId, { title: fallbackTitle });
        return fallbackTitle;
    }
}
