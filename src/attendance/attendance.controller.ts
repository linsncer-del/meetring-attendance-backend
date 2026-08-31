import type { Context } from 'hono'
import * as AttendanceService from './attendance.service.js'
import { ok, badRequest, notFound, serverError } from '../utils/response.js'
import { SubmitAttendanceSchema, ValidatePinSchema } from '../utils/validators.js'
import { writeAuditLog } from '../middleware/audit.middleware.js'
import { getClientIp } from '../utils/ip.js'
import type { HonoVariables } from '../types/index.js'

// POST /api/attendance/validate-pin (PUBLIC — verify PIN and open status before form)
export const validatePin = async (c: Context) => {
  try {
    const body = await c.req.json()
    const parsed = ValidatePinSchema.safeParse(body)
    if (!parsed.success) return badRequest(c, parsed.error.issues[0].message)

    const result = await AttendanceService.validateMeetingPin(
      parsed.data.meeting_id,
      parsed.data.meeting_pin
    )

    return ok(c, result)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'PIN verification failed'
    return badRequest(c, message)
  }
}

// GET /api/attendance/meeting-info/:meetingId  (PUBLIC — for the attendance form page)
export const getMeetingInfo = async (c: Context) => {
  try {
    const info = await AttendanceService.getPublicMeetingInfo(c.req.param('meetingId') || '')
    return ok(c, info)
  } catch {
    return notFound(c, 'Meeting not found')
  }
}

// POST /api/attendance/submit  (PUBLIC — participants submit attendance)
export const submit = async (c: Context) => {
  try {
    const body = await c.req.json()
    const parsed = SubmitAttendanceSchema.safeParse(body)
    if (!parsed.success) return badRequest(c, parsed.error.issues[0].message)

    const ip = getClientIp(c)

    const result = await AttendanceService.submitAttendance(parsed.data, ip)

    // Log (no user_id since this is a public endpoint)
    writeAuditLog(
      null,
      'attendance_submitted',
      `${parsed.data.participant_type} submitted for meeting: ${parsed.data.meeting_id}`,
      ip
    )

    return ok(c, {
      message: 'Attendance recorded successfully. Thank you!',
      ...result,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Submission failed'
    return badRequest(c, message)
  }
}

// GET /api/attendance/:meetingId  (PROTECTED — organizer, HR, admin)
export const getByMeeting = async (c: Context<{ Variables: HonoVariables }>) => {
  try {
    const data = await AttendanceService.getAttendanceByMeeting(c.req.param('meetingId') || '')
    return ok(c, data)
  } catch {
    return serverError(c)
  }
}
