import { NextFunction, Request, Response } from 'express';
import { ResponseUtil } from '../common/utils/response';
import { AIService } from '../services/ai.service';
import { BaseController } from './base.controller';
import { AIChatSession, AIChatMessage } from '../models';
import { AppError } from '../common/errors/app.error';
import { Types } from 'mongoose';

export class AIController extends BaseController {
    private aiService: AIService;

    constructor() {
        super();
        this.aiService = new AIService();
    }

    /**
     * Chat with AI using Server-Sent Events (SSE) for streaming responses
     */
    public chat = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const userId = this.getAuthenticatedUserId(req);
            const { message, sessionId } = req.body as { message: string; sessionId?: string };

            let session;
            if (sessionId) {
                session = await AIChatSession.findOne({ _id: sessionId, userId: new Types.ObjectId(userId) });
                if (!session) {
                    throw new AppError('AI chat session not found', 404);
                }
            } else {
                session = await AIChatSession.create({
                    userId: new Types.ObjectId(userId),
                    title: message.substring(0, 30) || 'New Chat',
                });
            }

            // Start streaming from Gemini (call API first before setting/sending headers, so that any failure generates a clean JSON error response)
            const resultStream = await this.aiService.sendMessageStream(message, session._id);

            // Set headers for Server-Sent Events (SSE)
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.flushHeaders();

            let isConnectionOpen = true;

            // Handle connection termination
            req.on('close', () => {
                isConnectionOpen = false;
            });

            let responseText = '';
            for await (const chunk of resultStream.stream) {
                if (!isConnectionOpen) {
                    break;
                }
                const chunkText = chunk.text();
                responseText += chunkText;

                // Send chunks to client
                res.write(`data: ${JSON.stringify({ chunk: chunkText, sessionId: session._id })}\n\n`);
            }

            if (isConnectionOpen) {
                // Save user prompt and AI response to DB
                await AIChatMessage.create({
                    sessionId: session._id,
                    role: 'user',
                    parts: [{ text: message }],
                });

                await AIChatMessage.create({
                    sessionId: session._id,
                    role: 'model',
                    parts: [{ text: responseText }],
                });

                // Update session updated timestamp
                await AIChatSession.findByIdAndUpdate(session._id, { updatedAt: new Date() });

                // Auto-summarize title asynchronously for the first turn in a session
                const msgCount = await AIChatMessage.countDocuments({ sessionId: session._id });
                if (msgCount <= 2) {
                    this.aiService.summarizeSessionTitle(session._id, message).catch((err) => {
                        console.error('Async title summarization failed:', err);
                    });
                }

                // Close SSE stream
                res.write('data: [DONE]\n\n');
                res.end();
            } else {
                res.end();
            }
        } catch (error) {
            next(error);
        }
    };

    /**
     * Retrieve paginated chat sessions for the current user
     */
    public getSessions = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const userId = this.getAuthenticatedUserId(req);
            const { page, pageSize } = this.getPaginationParams(req);

            const skip = (page - 1) * pageSize;
            const [sessions, total] = await Promise.all([
                AIChatSession.find({ userId: new Types.ObjectId(userId) })
                    .sort({ updatedAt: -1 })
                    .skip(skip)
                    .limit(pageSize)
                    .lean(),
                AIChatSession.countDocuments({ userId: new Types.ObjectId(userId) }),
            ]);

            const totalPages = Math.ceil(total / pageSize);

            ResponseUtil.paginated(
                res,
                sessions,
                {
                    page,
                    pageSize,
                    total,
                    totalPages,
                    hasNext: page < totalPages,
                    hasPrev: page > 1,
                },
                'AI Chat sessions retrieved successfully'
            );
        } catch (error) {
            next(error);
        }
    };

    /**
     * Get all messages in a specific session
     */
    public getSessionMessages = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const userId = this.getAuthenticatedUserId(req);
            const { sessionId } = req.params;

            const session = await AIChatSession.findOne({ _id: sessionId, userId: new Types.ObjectId(userId) }).lean();
            if (!session) {
                throw new AppError('AI chat session not found', 404);
            }

            const messages = await AIChatMessage.find({ sessionId })
                .sort({ createdAt: 1 })
                .lean();

            ResponseUtil.success(
                res,
                messages,
                'Session messages retrieved successfully'
            );
        } catch (error) {
            next(error);
        }
    };

    /**
     * Delete a specific chat session
     */
    public deleteSession = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const userId = this.getAuthenticatedUserId(req);
            const { sessionId } = req.params;

            const session = await AIChatSession.findOneAndDelete({ _id: sessionId, userId: new Types.ObjectId(userId) });
            if (!session) {
                throw new AppError('AI chat session not found', 404);
            }

            await AIChatMessage.deleteMany({ sessionId });

            ResponseUtil.success(
                res,
                { success: true },
                'AI chat session deleted successfully'
            );
        } catch (error) {
            next(error);
        }
    };

    /**
     * Clear all chat history for the user
     */
    public clearAllSessions = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const userId = this.getAuthenticatedUserId(req);

            const sessions = await AIChatSession.find({ userId: new Types.ObjectId(userId) }).select('_id').lean();
            const sessionIds = sessions.map((s) => s._id);

            await Promise.all([
                AIChatSession.deleteMany({ userId: new Types.ObjectId(userId) }),
                AIChatMessage.deleteMany({ sessionId: { $in: sessionIds } }),
            ]);

            ResponseUtil.success(
                res,
                { success: true },
                'All AI chat history cleared successfully'
            );
        } catch (error) {
            next(error);
        }
    };
}
