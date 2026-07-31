import { z } from 'zod';

// Chat message validation
export const chatValidation = {
    body: z.object({
        message: z.string().trim().min(1, 'Message is required'),
        sessionId: z
            .string()
            .regex(/^[0-9a-fA-F]{24}$/, 'Session ID không hợp lệ')
            .optional()
            .or(z.literal(''))
            .or(z.null()),
    }),
};

// Sessions list pagination query validation
export const getSessionsValidation = {
    query: z.object({
        page: z
            .string()
            .regex(/^\d+$/, 'Page must be a number')
            .optional()
            .transform((val) => (val ? parseInt(val, 10) : 1)),
        limit: z
            .string()
            .regex(/^\d+$/, 'Limit must be a number')
            .optional()
            .transform((val) => (val ? parseInt(val, 10) : 10)),
    }),
};

// Session ID parameter validation
export const sessionIdParamsValidation = {
    params: z.object({
        sessionId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Session ID không hợp lệ'),
    }),
};
