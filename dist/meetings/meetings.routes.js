import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';
import { list, getOne, getLive, create, update, openSessionAttendance, closeSessionAttendance, } from './meetings.controller.js';
const meetingsRouter = new Hono();
// All routes require authentication
meetingsRouter.use('*', authMiddleware);
// Read — all authenticated users
meetingsRouter.get('/', list);
meetingsRouter.get('/:id', getOne);
meetingsRouter.get('/:id/live', getLive);
// Write — meeting_creator, hr_officer, ict_admin (organizers create their own)
meetingsRouter.post('/', requireRole(['meeting_creator', 'hr_officer', 'ict_admin']), create);
meetingsRouter.patch('/:id', requireRole(['meeting_creator', 'hr_officer', 'ict_admin']), update);
// Open / Close session attendance
meetingsRouter.post('/sessions/:sessionId/open-attendance', requireRole(['meeting_creator', 'ict_admin']), openSessionAttendance);
meetingsRouter.post('/sessions/:sessionId/close-attendance', requireRole(['meeting_creator', 'ict_admin']), closeSessionAttendance);
export default meetingsRouter;
