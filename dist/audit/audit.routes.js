import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';
import { list } from './audit.controller.js';
const auditRouter = new Hono();
auditRouter.use('*', authMiddleware);
auditRouter.use('*', requireRole('ict_admin'));
auditRouter.get('/', list);
export default auditRouter;
