import express from 'express';
import helmet from 'helmet';
import apiRouter from './routes/routes';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import morgan from 'morgan';
import promClient from 'prom-client';
import { env } from './common/config';
import {
    globalErrorHandler,
    handleUncaughtException,
    handleUnhandledRejection,
    notFoundHandler,
} from './common/errors';

dotenv.config();

// Collect default metrics for Prometheus
promClient.collectDefaultMetrics();

const app = express();
app.set('trust proxy', 1);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use(
    helmet({
        crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
);
// Morgan logging format based on environment
const morganFormat = env.NODE_ENV === 'production' ? 'combined' : 'dev';
app.use(morgan(morganFormat));

const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS?.split(',') || [];
app.use(
    cors({
        origin: allowedOrigins,
        credentials: true,
    })
);

app.use('/api/v1', apiRouter);

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Server is healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Server is running',
        timestamp: new Date().toISOString(),
    });
});

// Prometheus metrics endpoint
app.get('/metrics', async (req, res) => {
    res.set('Content-Type', promClient.register.contentType);
    res.end(await promClient.register.metrics());
});

app.use(notFoundHandler);
app.use(globalErrorHandler);
handleUnhandledRejection();
handleUncaughtException();

export default app;
