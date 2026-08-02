import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';
import { list, getOne, create, update, remove } from './departments.controller.js';
const deptRouter = new Hono();
// Public read routes
deptRouter.get('/', list);
// All other routes require authentication
deptRouter.use('*', authMiddleware);
deptRouter.get('/:id', getOne);
// Only ICT Admin can write
deptRouter.post('/', requireRole('ict_admin'), create);
deptRouter.patch('/:id', requireRole('ict_admin'), update);
deptRouter.delete('/:id', requireRole('ict_admin'), remove);
export default deptRouter;
