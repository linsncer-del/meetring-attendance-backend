import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { attendanceRateLimit, pinRateLimit } from '../middleware/rateLimit.middleware.js'
import { requireRole } from '../middleware/role.middleware.js'
import { getMeetingInfo, signableDates, submit, getByMeeting, validatePin, updateRecord } from './attendance.controller.js'
import type { HonoVariables } from '../types/index.js'

const attendanceRouter = new Hono<{ Variables: HonoVariables }>()

// ── PUBLIC routes (no auth required) ────────────────────────────────
// Validate PIN & attendance open status before showing the form
attendanceRouter.post('/validate-pin', pinRateLimit, validatePin)

// Get meeting info for the public attendance page
attendanceRouter.get('/meeting-info/:meetingId', getMeetingInfo)

// Days a participant can still sign for, on a multi-day meeting
attendanceRouter.post('/signable-dates', signableDates) // general API limit only: a whole room may share one IP

// Submit attendance (rate-limited, no auth)
attendanceRouter.post('/submit', attendanceRateLimit, submit)

// ── PROTECTED routes ──────────────────────────────────────────────────
attendanceRouter.use('/:meetingId', authMiddleware)
attendanceRouter.get('/:meetingId', getByMeeting)

// Correct a filed record (two segments, so it never collides with /:meetingId)
attendanceRouter.patch(
  '/:participantType/:attendanceId',
  authMiddleware,
  requireRole(['meeting_creator', 'hr_officer', 'ict_admin']),
  updateRecord
)

export default attendanceRouter
