import dotenv from 'dotenv';
import { z } from 'zod';
dotenv.config();

const envSchema = z.object({
    // Cloudinary Config
    CLOUDINARY_NAME: z.string(),
    CLOUDINARY_KEY: z.string(),
    CLOUDINARY_SECRET: z.string(),

    // Node ENV
    NODE_ENV: z
        .enum(['development', 'production', 'test'])
        .default('development'),

    // Port
    PORT: z.string().default('8080'),

    // MongoDB
    MONGODB_URI: z.string(),

    // JWT
    JWT_SECRET: z.string(),
    JWT_EXPIRES_IN: z.string().default('7d'),
    JWT_REFRESH_SECRET: z.string(),

    // Redis
    REDIS_URL: z.string(),
    REDIS_HOST: z.string(),
    REDIS_PORT: z.string(),
    REDIS_PASSWORD: z.string(),

    // Client URL
    CLIENT_URL: z.string(),

    // Gmail user
    GMAIL_USER: z.string(),

    // Nodemailer Config
    NODEMAILER_REFRESH_TOKEN: z.string(),

    // Google Client
    GOOGLE_CLIENT_ID: z.string(),
    GOOGLE_CLIENT_SECRET: z.string(),

    // AI
    AI_API_KEY: z.string(),
    AI_MODEL: z.string(),
    AI_PROMPT: z.string(),
    AI_LIMIT_HOUR: z.string(),
    AI_LIMIT_MESSAGE: z.string(),

    // Resend
    RESEND_API_KEY: z.string(),
    RESEND_FROM_EMAIL: z.string(),

    // Realtime Service
    REALTIME_SERVICE_URL: z.string(),
    INTERNAL_SECRET_KEY: z.string(),

    // Maintenance
    MAINTENANCE_MODE: z.string().optional().default('false'),
    MAINTENANCE_MESSAGE: z.string().optional().default('Hệ thống đang bảo trì nâng cấp. Vui lòng quay lại sau!'),
});

// Process env validation
const envProcess = envSchema.safeParse({
    // Cloudinary Config
    CLOUDINARY_NAME: process.env.CLOUDINARY_NAME,
    CLOUDINARY_KEY: process.env.CLOUDINARY_KEY,
    CLOUDINARY_SECRET: process.env.CLOUDINARY_SECRET,

    // Node ENV
    NODE_ENV: process.env.NODE_ENV,

    // Port
    PORT: process.env.PORT,

    // MongoDB
    MONGODB_URI: process.env.MONGODB_URI,

    // JWT
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,

    // Redis
    REDIS_URL: process.env.REDIS_URL,
    REDIS_HOST: process.env.REDIS_HOST,
    REDIS_PORT: process.env.REDIS_PORT,
    REDIS_PASSWORD: process.env.REDIS_PASSWORD,

    // Client URL
    CLIENT_URL: process.env.CLIENT_URL,

    // Gmail user
    GMAIL_USER: process.env.GMAIL_USER,

    // Nodemailer Config
    NODEMAILER_REFRESH_TOKEN: process.env.NODEMAILER_REFRESH_TOKEN,

    // Google Client
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,

    // AI
    AI_API_KEY: process.env.AI_API_KEY,
    AI_MODEL: process.env.AI_MODEL,
    AI_PROMPT: process.env.AI_PROMPT,
    AI_LIMIT_HOUR: process.env.AI_LIMIT_HOUR,
    AI_LIMIT_MESSAGE: process.env.AI_LIMIT_MESSAGE,

    // Resend
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,

    // Realtime Service
    REALTIME_SERVICE_URL: process.env.REALTIME_SERVICE_URL,
    INTERNAL_SECRET_KEY: process.env.INTERNAL_SECRET_KEY,

    // Maintenance
    MAINTENANCE_MODE: process.env.MAINTENANCE_MODE,
    MAINTENANCE_MESSAGE: process.env.MAINTENANCE_MESSAGE,
});

if (!envProcess.success) {
    console.error(
        '❌ Invalid environment variables:',
        envProcess.error.format()
    );
    throw new Error('Invalid environment variables');
}

export const env = envProcess.data;
