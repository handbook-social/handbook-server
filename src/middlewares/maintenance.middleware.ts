import { Request, Response, NextFunction } from 'express';
import { env } from '../common/config';
import redis, { isRedisReady } from '../common/utils/redis';

// Simple in-memory cache for maintenance status to avoid Redis overhead per request
let inMemoryMaintenanceState: {
    isMaintenance: boolean;
    message?: string;
    lastChecked: number;
} = {
    isMaintenance: env.MAINTENANCE_MODE === 'true',
    message: env.MAINTENANCE_MESSAGE,
    lastChecked: 0,
};

export const setInMemoryMaintenance = (isMaintenance: boolean, message?: string) => {
    inMemoryMaintenanceState = {
        isMaintenance,
        message,
        lastChecked: Date.now(),
    };
};

export const maintenanceMiddleware = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const path = req.path;

    // Allowed paths during maintenance
    const isExempted =
        path === '/' ||
        path === '/health' ||
        path === '/metrics' ||
        path.startsWith('/api/v1/internal') ||
        path.startsWith('/api/v1/admin/maintenance');

    if (isExempted) {
        return next();
    }

    let isMaintenance = env.MAINTENANCE_MODE === 'true' || inMemoryMaintenanceState.isMaintenance;
    let message = inMemoryMaintenanceState.message || env.MAINTENANCE_MESSAGE;

    // Periodically refresh from Redis (every 5 seconds) if Redis is ready
    const now = Date.now();
    if (isRedisReady() && now - inMemoryMaintenanceState.lastChecked > 5000) {
        try {
            const redisVal = await redis.get('system:maintenance_mode');
            if (redisVal !== null) {
                const parsed = JSON.parse(redisVal);
                isMaintenance = env.MAINTENANCE_MODE === 'true' || Boolean(parsed.active);
                if (parsed.message) message = parsed.message;
            } else {
                isMaintenance = env.MAINTENANCE_MODE === 'true';
            }
            inMemoryMaintenanceState = {
                isMaintenance,
                message,
                lastChecked: now,
            };
        } catch {
            // Keep current in-memory state on error
        }
    }

    if (isMaintenance) {
        return res.status(503).json({
            success: false,
            code: 'SERVER_MAINTENANCE',
            message:
                message ||
                'Hệ thống đang được nâng cấp bảo trì định kỳ. Vui lòng quay lại sau ít phút!',
            timestamp: new Date().toISOString(),
        });
    }

    next();
};
