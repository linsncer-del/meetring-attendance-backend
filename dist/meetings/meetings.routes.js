import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';
import { list, getOne, getLive, getDashboardStats, create, update, openAttendance, closeAttendance, extendAttendance, sendReminders, } from './meetings.controller.js';
const meetingsRouter = new Hono();
// All routes require authentication
meetingsRouter.use('*', authMiddleware);
// Read — all authenticated users
meetingsRouter.get('/', list);
// Must be registered before /:id so it isn't swallowed as a meeting-id param
meetingsRouter.get('/dashboard-stats', requireRole(['ict_admin', 'hr_officer']), getDashboardStats);
meetingsRouter.get('/:id', getOne);
meetingsRouter.get('/:id/live', getLive);
// Write — meeting_creator, hr_officer, ict_admin (organizers create their own)
meetingsRouter.post('/', requireRole(['meeting_creator', 'hr_officer', 'ict_admin']), create);
meetingsRouter.patch('/:id', requireRole(['meeting_creator', 'hr_officer', 'ict_admin']), update);
// Open / Close / Extend attendance
meetingsRouter.post('/:id/open-attendance', requireRole(['meeting_creator', 'ict_admin']), openAttendance);
meetingsRouter.post('/:id/extend-attendance', requireRole(['meeting_creator', 'ict_admin']), extendAttendance);
meetingsRouter.post('/:id/close-attendance', requireRole(['meeting_creator', 'ict_admin']), closeAttendance);
// Send daily / multi-day attendance reminders via Resend
meetingsRouter.post('/:id/send-reminders', requireRole(['meeting_creator', 'ict_admin']), sendReminders);
export default meetingsRouter;
