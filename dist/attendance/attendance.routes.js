import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { attendanceRateLimit } from '../middleware/rateLimit.middleware.js';
import { getMeetingInfo, submit, getByMeeting } from './attendance.controller.js';
const attendanceRouter = new Hono();
// ── PUBLIC routes (no auth required) ────────────────────────────────
// Get meeting info for the public attendance page
attendanceRouter.get('/meeting-info/:meetingId', getMeetingInfo);
// Submit attendance (rate-limited, no auth)
attendanceRouter.post('/submit', attendanceRateLimit, submit);
// ── PROTECTED routes ──────────────────────────────────────────────────
attendanceRouter.use('/:meetingId', authMiddleware);
attendanceRouter.get('/:meetingId', getByMeeting);
export default attendanceRouter;
