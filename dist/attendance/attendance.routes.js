import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { attendanceRateLimit } from '../middleware/rateLimit.middleware.js';
import { getMeetingInfo, submit, getByMeeting, validatePin } from './attendance.controller.js';
const attendanceRouter = new Hono();
// ── PUBLIC routes (no auth required) ────────────────────────────────
// Validate PIN & attendance open status before showing the form
attendanceRouter.post('/validate-pin', attendanceRateLimit, validatePin);
// Get meeting info for the public attendance page
attendanceRouter.get('/meeting-info/:meetingId', getMeetingInfo);
// Submit attendance (rate-limited, no auth)
attendanceRouter.post('/submit', attendanceRateLimit, submit);
// ── PROTECTED routes ──────────────────────────────────────────────────
attendanceRouter.use('/:meetingId', authMiddleware);
attendanceRouter.get('/:meetingId', getByMeeting);
export default attendanceRouter;
