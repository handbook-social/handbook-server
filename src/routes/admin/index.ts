import { Router } from 'express';
import userAdminRouter from './users.route';
import groupAdminRouter from './groups.route';
import redis, { isRedisReady } from '../../common/utils/redis';
import { setInMemoryMaintenance } from '../../middlewares/maintenance.middleware';

const adminRouter = Router();

adminRouter.use('/users', userAdminRouter);
adminRouter.use('/groups', groupAdminRouter);

// Dynamic maintenance toggle endpoint for admins
adminRouter.post('/maintenance', async (req, res) => {
    try {
        const { active, message } = req.body;

        if (typeof active !== 'boolean') {
            return res.status(400).json({
                success: false,
                message: 'Invalid parameters: "active" boolean field is required',
            });
        }

        setInMemoryMaintenance(active, message);

        if (isRedisReady()) {
            const payload = JSON.stringify({ active, message, updatedAt: new Date().toISOString() });
            await redis.set('system:maintenance_mode', payload);
            await redis.publish('system:maintenance', payload);
        }

        return res.status(200).json({
            success: true,
            message: `Maintenance mode ${active ? 'activated' : 'deactivated'} successfully`,
            data: { active, message },
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: 'Failed to update maintenance mode',
            error: error.message,
        });
    }
});

export default adminRouter;
