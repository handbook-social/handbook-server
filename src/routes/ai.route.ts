import { Router } from 'express';
import { AIController } from '../controllers/ai.controller';
import { EApiMethod, IApiRoute } from '../common/types/route.type';
import addRoutes from '../common/utils/add-route';
import { aiRateLimiter } from '../common/middleware/rateLimit';
import {
    chatValidation,
    getSessionsValidation,
    sessionIdParamsValidation,
} from '../validations/ai.validation';

const aiRouter = Router();
const aiController = new AIController();

const aiRoutes: IApiRoute[] = [
    {
        path: '/chat',
        method: EApiMethod.POST,
        controller: aiController.chat,
        isPrivateRoute: true,
        isRateLimited: true,
        validate: chatValidation,
        middlewares: [aiRateLimiter],
    },
    {
        path: '/sessions',
        method: EApiMethod.GET,
        controller: aiController.getSessions,
        isPrivateRoute: true,
        isRateLimited: false,
        validate: getSessionsValidation,
    },
    {
        path: '/sessions/:sessionId/messages',
        method: EApiMethod.GET,
        controller: aiController.getSessionMessages,
        isPrivateRoute: true,
        isRateLimited: false,
        validate: sessionIdParamsValidation,
    },
    {
        path: '/sessions/:sessionId',
        method: EApiMethod.DELETE,
        controller: aiController.deleteSession,
        isPrivateRoute: true,
        isRateLimited: false,
        validate: sessionIdParamsValidation,
    },
    {
        path: '/sessions',
        method: EApiMethod.DELETE,
        controller: aiController.clearAllSessions,
        isPrivateRoute: true,
        isRateLimited: false,
    },
];

addRoutes(aiRouter, aiRoutes);

export default aiRouter;
