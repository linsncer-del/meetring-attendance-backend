import * as MeetingsService from './meetings.service.js';
import { ok, created, badRequest, notFound, serverError, paginated, } from '../utils/response.js';
import { CreateMeetingSchema, UpdateMeetingSchema, PaginationSchema } from '../utils/validators.js';
import { writeAuditLog } from '../middleware/audit.middleware.js';
// GET /api/meetings
export const list = async (c) => {
    try {
        const user = c.get('user');
        const { page, limit } = PaginationSchema.parse({
            page: c.req.query('page'),
            limit: c.req.query('limit'),
        });
        const filters = {
            status: c.req.query('status'),
            meetingType: c.req.query('type'),
            search: c.req.query('search'),
            departmentId: c.req.query('department_id'),
        };
        const { meetings, total } = await MeetingsService.listMeetings(user.id, user.role, page, limit, filters);
        return paginated(c, meetings, total, page, limit);
    }
    catch {
        return serverError(c);
    }
};
// GET /api/meetings/:id
export const getOne = async (c) => {
    try {
        const meeting = await MeetingsService.getMeetingById(c.req.param('id') || '');
        return ok(c, meeting);
    }
    catch {
        return notFound(c);
    }
};
// GET /api/meetings/:id/live
export const getLive = async (c) => {
    try {
        const summary = await MeetingsService.getMeetingLiveSummary(c.req.param('id') || '');
        return ok(c, summary);
    }
    catch {
        return notFound(c);
    }
};
// POST /api/meetings
export const create = async (c) => {
    try {
        const user = c.get('user');
        const body = await c.req.json();
        const parsed = CreateMeetingSchema.safeParse(body);
        if (!parsed.success)
            return badRequest(c, parsed.error.issues[0].message);
        const meeting = await MeetingsService.createMeeting(parsed.data, user.id);
        const ip = c.req.header('x-forwarded-for') ?? undefined;
        writeAuditLog(user.id, 'meeting_created', `Meeting created: ${meeting.title}`, ip);
        return created(c, meeting);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create meeting';
        return badRequest(c, message);
    }
};
// PATCH /api/meetings/:id
export const update = async (c) => {
    try {
        const user = c.get('user');
        const body = await c.req.json();
        const parsed = UpdateMeetingSchema.safeParse(body);
        if (!parsed.success)
            return badRequest(c, parsed.error.issues[0].message);
        const meeting = await MeetingsService.updateMeeting(c.req.param('id') || '', parsed.data, user.id, user.role);
        const ip = c.req.header('x-forwarded-for') ?? undefined;
        writeAuditLog(user.id, 'meeting_updated', `Meeting updated: ${meeting.title}`, ip);
        return ok(c, meeting);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Update failed';
        return badRequest(c, message);
    }
};
// POST /api/meetings/sessions/:sessionId/open-attendance
export const openSessionAttendance = async (c) => {
    try {
        const user = c.get('user');
        const sessionId = c.req.param('sessionId') || '';
        await MeetingsService.openSessionAttendance(sessionId, user.id, user.role);
        const ip = c.req.header('x-forwarded-for') ?? undefined;
        writeAuditLog(user.id, 'attendance_opened', `Opened attendance for session: ${sessionId}`, ip);
        return ok(c, { message: 'Session attendance is now OPEN' });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to open session attendance';
        return badRequest(c, message);
    }
};
// POST /api/meetings/sessions/:sessionId/close-attendance
export const closeSessionAttendance = async (c) => {
    try {
        const user = c.get('user');
        const sessionId = c.req.param('sessionId') || '';
        await MeetingsService.closeSessionAttendance(sessionId, user.id, user.role);
        const ip = c.req.header('x-forwarded-for') ?? undefined;
        writeAuditLog(user.id, 'attendance_closed', `Closed attendance for session: ${sessionId}`, ip);
        return ok(c, { message: 'Session attendance is now CLOSED' });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to close session attendance';
        return badRequest(c, message);
    }
};
