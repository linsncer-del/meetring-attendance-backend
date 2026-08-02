import type { Context } from 'hono'
import * as MeetingsService from './meetings.service.js'
import {
  ok, created, badRequest, notFound, serverError, paginated,
} from '../utils/response.js'
import { CreateMeetingSchema, UpdateMeetingSchema, PaginationSchema } from '../utils/validators.js'
import { writeAuditLog } from '../middleware/audit.middleware.js'
import type { HonoVariables } from '../types/index.js'

// GET /api/meetings
export const list = async (c: Context<{ Variables: HonoVariables }>) => {
  try {
    const user = c.get('user')
    const { page, limit } = PaginationSchema.parse({
      page: c.req.query('page'),
      limit: c.req.query('limit'),
    })
    const filters = {
      status: c.req.query('status'),
      meetingType: c.req.query('type'),
      search: c.req.query('search'),
      departmentId: c.req.query('department_id'),
    }
    const { meetings, total } = await MeetingsService.listMeetings(user.id, user.role, page, limit, filters)
    return paginated(c, meetings, total, page, limit)
  } catch {
    return serverError(c)
  }
}

// GET /api/meetings/:id
export const getOne = async (c: Context<{ Variables: HonoVariables }>) => {
  try {
    const meeting = await MeetingsService.getMeetingById(c.req.param('id') || '')
    return ok(c, meeting)
  } catch {
    return notFound(c)
  }
}

// GET /api/meetings/:id/live
export const getLive = async (c: Context<{ Variables: HonoVariables }>) => {
  try {
    const summary = await MeetingsService.getMeetingLiveSummary(c.req.param('id') || '')
    return ok(c, summary)
  } catch {
    return notFound(c)
  }
}

// POST /api/meetings
export const create = async (c: Context<{ Variables: HonoVariables }>) => {
  try {
    const user = c.get('user')
    const body = await c.req.json()
    const parsed = CreateMeetingSchema.safeParse(body)
    if (!parsed.success) return badRequest(c, parsed.error.issues[0].message)

    const meeting = await MeetingsService.createMeeting(parsed.data, user.id)
    const ip = c.req.header('x-forwarded-for') ?? undefined
    writeAuditLog(user.id, 'meeting_created', `Meeting created: ${meeting.title}`, ip)

    return created(c, meeting)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create meeting'
    return badRequest(c, message)
  }
}

// PATCH /api/meetings/:id
export const update = async (c: Context<{ Variables: HonoVariables }>) => {
  try {
    const user = c.get('user')
    const body = await c.req.json()
    const parsed = UpdateMeetingSchema.safeParse(body)
    if (!parsed.success) return badRequest(c, parsed.error.issues[0].message)

    const meeting = await MeetingsService.updateMeeting(
      c.req.param('id') || '', parsed.data, user.id, user.role
    )
    const ip = c.req.header('x-forwarded-for') ?? undefined
    writeAuditLog(user.id, 'meeting_updated', `Meeting updated: ${meeting.title}`, ip)

    return ok(c, meeting)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Update failed'
    return badRequest(c, message)
  }
}

// POST /api/meetings/:id/open-attendance
export const openAttendance = async (c: Context<{ Variables: HonoVariables }>) => {
  try {
    const user = c.get('user')
    await MeetingsService.openAttendance(c.req.param('id') || '', user.id, user.role)

    const ip = c.req.header('x-forwarded-for') ?? undefined
    writeAuditLog(user.id, 'attendance_opened', `Opened attendance for meeting: ${c.req.param('id') || ''}`, ip)

    return ok(c, { message: 'Attendance is now OPEN' })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to open attendance'
    return badRequest(c, message)
  }
}

// POST /api/meetings/:id/close-attendance
export const closeAttendance = async (c: Context<{ Variables: HonoVariables }>) => {
  try {
    const user = c.get('user')
    await MeetingsService.closeAttendance(c.req.param('id') || '', user.id, user.role)

    const ip = c.req.header('x-forwarded-for') ?? undefined
    writeAuditLog(user.id, 'attendance_closed', `Closed attendance for meeting: ${c.req.param('id') || ''}`, ip)

    return ok(c, { message: 'Attendance is now CLOSED' })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to close attendance'
    return badRequest(c, message)
  }
}
