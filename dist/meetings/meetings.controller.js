import * as MeetingsService from './meetings.service.js';
import { ok, created, badRequest, notFound, serverError, paginated, } from '../utils/response.js';
import { CreateMeetingSchema, UpdateMeetingSchema, PaginationSchema, ExtendAttendanceSchema } from '../utils/validators.js';
import { writeAuditLog } from '../middleware/audit.middleware.js';
import { getClientIp } from '../utils/ip.js';
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
// GET /api/meetings/dashboard-stats
export const getDashboardStats = async (c) => {
    try {
        const stats = await MeetingsService.getDashboardStats();
        return ok(c, stats);
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
        const body = await c.req.json().catch(() => ({}));
        const parsed = CreateMeetingSchema.safeParse(body);
        if (!parsed.success) {
            console.error('[CreateMeeting Validation Error]', parsed.error.issues);
            return badRequest(c, parsed.error.issues[0].message);
        }
        const meeting = await MeetingsService.createMeeting(parsed.data, user.id);
        const ip = getClientIp(c);
        writeAuditLog(user.id, 'meeting_created', `Meeting created: ${meeting.title}`, ip);
        return created(c, meeting);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create meeting';
        console.error('[CreateMeeting Error]', err);
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
        const ip = getClientIp(c);
        writeAuditLog(user.id, 'meeting_updated', `Meeting updated: ${meeting.title}`, ip);
        return ok(c, meeting);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Update failed';
        return badRequest(c, message);
    }
};
// POST /api/meetings/:id/open-attendance
export const openAttendance = async (c) => {
    try {
        const user = c.get('user');
        await MeetingsService.openAttendance(c.req.param('id') || '', user.id, user.role);
        const ip = getClientIp(c);
        writeAuditLog(user.id, 'attendance_opened', `Opened attendance for meeting: ${c.req.param('id') || ''}`, ip);
        return ok(c, { message: 'Attendance is now OPEN' });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to open attendance';
        return badRequest(c, message);
    }
};
// POST /api/meetings/:id/extend-attendance
export const extendAttendance = async (c) => {
    try {
        const user = c.get('user');
        const body = await c.req.json().catch(() => ({}));
        const parsed = ExtendAttendanceSchema.safeParse(body);
        const minutes = parsed.success ? parsed.data.minutes : 30;
        const meeting = await MeetingsService.extendAttendance(c.req.param('id') || '', minutes, user.id, user.role);
        const ip = getClientIp(c);
        writeAuditLog(user.id, 'attendance_opened', `Extended attendance by ${minutes} mins for meeting: ${c.req.param('id') || ''}`, ip);
        return ok(c, { message: `Attendance extended by ${minutes} minutes and is now OPEN`, meeting });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to extend attendance';
        return badRequest(c, message);
    }
};
// POST /api/meetings/:id/close-attendance
export const closeAttendance = async (c) => {
    try {
        const user = c.get('user');
        await MeetingsService.closeAttendance(c.req.param('id') || '', user.id, user.role);
        const ip = getClientIp(c);
        writeAuditLog(user.id, 'attendance_closed', `Closed attendance for meeting: ${c.req.param('id') || ''}`, ip);
        return ok(c, { message: 'Attendance is now CLOSED' });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to close attendance';
        return badRequest(c, message);
    }
};
// POST /api/meetings/:id/send-reminders
export const sendReminders = async (c) => {
    try {
        const user = c.get('user');
        const body = await c.req.json().catch(() => ({}));
        const result = await MeetingsService.sendMeetingReminders(c.req.param('id') || '', body, user.id, user.role);
        const ip = getClientIp(c);
        writeAuditLog(user.id, 'attendance_reminders_sent', `Sent ${result.sentCount} attendance reminder emails for meeting: ${c.req.param('id') || ''}`, ip);
        return ok(c, { message: `Successfully sent ${result.sentCount} reminder email(s) via Resend`, result });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to send reminders';
        return badRequest(c, message);
    }
};
// DELETE /api/meetings/:id
export const remove = async (c) => {
    try {
        const user = c.get('user');
        const result = await MeetingsService.deleteMeeting(c.req.param('id') || '', user.id, user.role);
        const ip = getClientIp(c);
        writeAuditLog(user.id, 'meeting_deleted', `Deleted meeting: ${c.req.param('id') || ''}`, ip);
        return ok(c, result);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete meeting';
        return badRequest(c, message);
    }
};
