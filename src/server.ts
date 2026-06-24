import app from './app';
import { env } from './common/config';
import {
    connectToMongo,
    disconnectFromMongo,
    isMongoConnected,
} from './common/utils/mongodb';
import redis from './common/utils/redis';
import { redisPubSubService } from './services/redis-pubsub.service';
import logger from './common/logger';

let server: ReturnType<typeof app.listen> | null = null;

/**
 * Starts the Express server
 */
const startServer = async (): Promise<void> => {
    try {
        // Connect to MongoDB
        await connectToMongo();

        // Start the Express server
        server = app.listen(env.PORT, () => {
            logger.info(
                `Server is running on port: ${env.PORT} (${env.NODE_ENV})`
            );
        });

        // Handle server errors
        server.on('error', (error: NodeJS.ErrnoException) => {
            if (error.syscall !== 'listen') {
                throw error;
            }

            const bind =
                typeof env.PORT === 'string'
                    ? `Pipe ${env.PORT}`
                    : `Port ${env.PORT}`;

            switch (error.code) {
                case 'EACCES':
                    logger.error(`${bind} requires elevated privileges`);
                    process.exit(1);
                case 'EADDRINUSE':
                    logger.error(`${bind} is already in use`);
                    process.exit(1);
                default:
                    throw error;
            }
        });
    } catch (error) {
        logger.error('Failed to start server:', error as Error);
        process.exit(1);
    }
};

/**
 * Gracefully shuts down the server
 */
const shutdown = async (signal: string): Promise<void> => {
    logger.info(`\n${signal} received. Shutting down gracefully...`);

    if (server) {
        server.close(async () => {
            logger.info('HTTP server closed');

            try {
                // Disconnect from MongoDB
                if (isMongoConnected()) {
                    await disconnectFromMongo();
                }

                // Disconnect from Redis
                try {
                    await redis.quit();
                    logger.info('Redis client disconnected');
                } catch (redisError) {
                    logger.warn(
                        'Redis client disconnect warning: ' + (redisError as Error).message
                    );
                }

                // Disconnect from Redis Pub/Sub
                try {
                    await redisPubSubService.disconnect();
                    logger.info('Redis Pub/Sub disconnected');
                } catch (pubsubError) {
                    logger.warn(
                        'Redis Pub/Sub disconnect warning: ' + (pubsubError as Error).message
                    );
                }

                logger.info('Graceful shutdown completed');
                process.exit(0);
            } catch (error) {
                logger.error('Error during shutdown:', error as Error);
                process.exit(1);
            }
        });

        // Force close after 10 seconds
        setTimeout(() => {
            logger.error(
                'Forced shutdown after timeout. Some connections may not have closed properly.'
            );
            process.exit(1);
        }, 10000);
    } else {
        process.exit(0);
    }
};

// Handle graceful shutdown
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at: ' + promise + ' reason: ' + reason);
    shutdown('unhandledRejection');
});

// Start the server
startServer().catch((error) => {
    logger.error('Fatal error starting server:', error as Error);
    process.exit(1);
});
