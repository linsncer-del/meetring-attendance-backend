import { randomUUID } from 'node:crypto';
import { supabaseAdmin } from '../config/supabase.js';
import { generateUniquePinForDate } from '../utils/pin.js';
import { buildAttendanceUrl, generateQRCodeBase64 } from '../utils/qrcode.js';
import { sendMail, templates } from '../config/mailer.js';
// ── List meetings ─────────────────────────────────────────────────────
export const listMeetings = async (userId, role, page = 1, limit = 500, filters) => {
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    let query = supabaseAdmin
        .from('meetings')
        .select(`*, 
       profiles!meetings_created_by_fkey(full_name, email),
       departments(name, department_code)`, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);
    // Meeting creators only see their own meetings; HR and admins see all
    if (role === 'meeting_creator' || role === 'organizer') {
        query = query.eq('created_by', userId);
    }
    if (filters?.status)
        query = query.eq('attendance_status', filters.status);
    if (filters?.meetingType)
        query = query.eq('meeting_type', filters.meetingType);
    if (filters?.departmentId)
        query = query.eq('department_id', filters.departmentId);
    if (filters?.search)
        query = query.ilike('title', `%${filters.search}%`);
    const { data, error, count } = await query;
    if (error) {
        // Fallback if relation join fails
        let fallbackQuery = supabaseAdmin
            .from('meetings')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(from, to);
        if (role === 'meeting_creator' || role === 'organizer') {
            fallbackQuery = fallbackQuery.eq('created_by', userId);
        }
        if (filters?.status)
            fallbackQuery = fallbackQuery.eq('attendance_status', filters.status);
        if (filters?.meetingType)
            fallbackQuery = fallbackQuery.eq('meeting_type', filters.meetingType);
        if (filters?.departmentId)
            fallbackQuery = fallbackQuery.eq('department_id', filters.departmentId);
        if (filters?.search)
            fallbackQuery = fallbackQuery.ilike('title', `%${filters.search}%`);
        const fallbackRes = await fallbackQuery;
        if (fallbackRes.error)
            throw new Error(fallbackRes.error.message);
        return { meetings: fallbackRes.data, total: fallbackRes.count ?? 0 };
    }
    return { meetings: data, total: count ?? 0 };
};
// ── Admin dashboard stats (system-wide, accurate raw counts) ───────────
export const getDashboardStats = async () => {
    const [staffRes, visitorRes] = await Promise.all([
        supabaseAdmin.from('attendance_staff').select('attendance_id', { count: 'exact', head: true }),
        supabaseAdmin.from('attendance_visitor').select('attendance_id', { count: 'exact', head: true }),
    ]);
    if (staffRes.error)
        throw new Error(staffRes.error.message);
    if (visitorRes.error)
        throw new Error(visitorRes.error.message);
    return {
        totalAttendanceStaff: staffRes.count ?? 0,
        totalAttendanceVisitors: visitorRes.count ?? 0,
        totalAttendance: (staffRes.count ?? 0) + (visitorRes.count ?? 0),
    };
};
// ── Get single meeting ────────────────────────────────────────────────
export const getMeetingById = async (meetingId) => {
    const { data, error } = await supabaseAdmin
        .from('meetings')
        .select(`
      *,
      profiles!meetings_created_by_fkey(full_name, email),
      departments(name, department_code)
    `)
        .eq('meeting_id', meetingId)
        .single();
    if (error || !data)
        throw new Error('Meeting not found');
    return data;
};
// ── Get live attendance summary ───────────────────────────────────────
export const getMeetingLiveSummary = async (meetingId) => {
    const { data, error } = await supabaseAdmin
        .from('vw_meeting_attendance_summary')
        .select('*')
        .eq('meeting_id', meetingId)
        .single();
    if (error || !data)
        throw new Error('Meeting not found');
    return data;
};
// ── Create meeting ────────────────────────────────────────────────────
export const createMeeting = async (input, createdBy) => {
    const trimmedTitle = input.title.trim();
    const customPin = (input.meeting_pin && input.meeting_pin.trim() !== '') ? input.meeting_pin.trim() : null;
    // 1 & 2. Title-uniqueness check and PIN resolution are independent of
    // each other — run them concurrently instead of one-after-another.
    const [duplicateRes, pin] = await Promise.all([
        supabaseAdmin
            .from('meetings')
            .select('meeting_id, title')
            .ilike('title', trimmedTitle)
            .eq('meeting_date', input.meeting_date)
            .maybeSingle(),
        customPin
            ? supabaseAdmin
                .from('meetings')
                .select('meeting_id')
                .eq('meeting_pin', customPin)
                .eq('meeting_date', input.meeting_date)
                .maybeSingle()
                .then(({ data }) => {
                if (data)
                    throw new Error(`The PIN ${customPin} is already in use for another meeting on this date`);
                return customPin;
            })
            : generateUniquePinForDate(input.meeting_date),
    ]);
    if (duplicateRes.data) {
        throw new Error(`A meeting with the title "${trimmedTitle}" already exists on ${input.meeting_date}. Please use a unique title.`);
    }
    // 3. Pre-generate meeting ID and the (deterministic, no-network) attendance URL
    const meetingId = randomUUID();
    const attendanceUrl = buildAttendanceUrl(meetingId);
    const deptId = (input.department_id && input.department_id.trim() !== '' && input.department_id !== 'undefined' && input.department_id !== 'null')
        ? input.department_id.trim()
        : null;
    const venue = (input.venue && input.venue.trim() !== '') ? input.venue.trim() : null;
    const virtualLink = (input.virtual_link && input.virtual_link.trim() !== '') ? input.virtual_link.trim() : null;
    const description = (input.description && input.description.trim() !== '') ? input.description.trim() : null;
    // 4. Single atomic insertion with all fields — no separate update step.
    // qr_code_url is intentionally left null here: it's generated and
    // uploaded to Storage in the background after this responds (see
    // below) since nothing in the frontend reads it synchronously — the
    // QR code shown to organizers is rendered client-side from
    // attendance_url instead. That removed a Storage round-trip from the
    // critical path of every meeting creation.
    const { data: meeting, error } = await supabaseAdmin
        .from('meetings')
        .insert({
        meeting_id: meetingId,
        title: trimmedTitle,
        description,
        meeting_type: input.meeting_type,
        venue,
        virtual_link: virtualLink,
        meeting_date: input.meeting_date,
        start_time: input.start_time,
        end_time: input.end_time,
        attendance_open_time: input.attendance_open_time,
        attendance_close_time: input.attendance_close_time,
        department_id: deptId,
        created_by: createdBy,
        meeting_pin: pin,
        attendance_url: attendanceUrl,
        qr_code_url: null,
        form_config: input.form_config ?? null,
        department_label: input.department_label ?? null,
    })
        .select()
        .single();
    if (error) {
        console.error('[CreateMeeting Insert Error]', error);
        throw new Error(error.message);
    }
    // 5. Generate + upload the QR code in the background — don't make the
    // caller wait on a Storage round-trip for a field nothing reads yet.
    generateAndStoreQrCode(meetingId, attendanceUrl).catch(qrErr => {
        console.warn('[CreateMeeting] Background QR generation notice:', qrErr);
    });
    return meeting;
};
// ── Background QR code generation (fire-and-forget from createMeeting) ─
const generateAndStoreQrCode = async (meetingId, attendanceUrl) => {
    const qrCodeBase64 = await generateQRCodeBase64(attendanceUrl);
    const qrPath = `qrcodes/${meetingId}.png`;
    const qrBuffer = Buffer.from(qrCodeBase64.replace(/^data:image\/png;base64,/, ''), 'base64');
    const { error: storageError } = await supabaseAdmin.storage
        .from('kmtams-assets')
        .upload(qrPath, qrBuffer, { contentType: 'image/png', upsert: true });
    if (storageError) {
        console.warn('[CreateMeeting] QR Storage upload notice:', storageError.message);
        return;
    }
    const { data: publicUrl } = supabaseAdmin.storage
        .from('kmtams-assets')
        .getPublicUrl(qrPath);
    await supabaseAdmin
        .from('meetings')
        .update({ qr_code_url: publicUrl.publicUrl })
        .eq('meeting_id', meetingId);
};
// ── Update meeting ────────────────────────────────────────────────────
export const updateMeeting = async (meetingId, input, requesterId, requesterRole) => {
    // Ownership check
    const { data: existing, error: fetchErr } = await supabaseAdmin
        .from('meetings')
        .select('created_by, attendance_status, title, meeting_date')
        .eq('meeting_id', meetingId)
        .single();
    if (fetchErr || !existing)
        throw new Error('Meeting not found');
    if (requesterRole !== 'ict_admin' && existing.created_by !== requesterId) {
        throw new Error('You can only update meetings you created');
    }
    if (existing.attendance_status !== 'not_started') {
        throw new Error('Cannot update a meeting after attendance has been opened');
    }
    // Check title uniqueness on updated date/title
    if (input.title || input.meeting_date) {
        const checkTitle = (input.title ?? existing.title).trim();
        const checkDate = input.meeting_date ?? existing.meeting_date;
        const { data: duplicate } = await supabaseAdmin
            .from('meetings')
            .select('meeting_id')
            .ilike('title', checkTitle)
            .eq('meeting_date', checkDate)
            .neq('meeting_id', meetingId)
            .maybeSingle();
        if (duplicate) {
            throw new Error(`Another meeting with the title "${checkTitle}" already exists on ${checkDate}`);
        }
    }
    const updates = { updated_at: new Date().toISOString() };
    const fields = [
        'title', 'description', 'meeting_type', 'venue', 'virtual_link',
        'meeting_date', 'start_time', 'end_time', 'attendance_open_time',
        'attendance_close_time', 'department_id', 'department_label', 'form_config',
    ];
    for (const f of fields) {
        if (input[f] !== undefined)
            updates[f] = input[f];
    }
    const { data, error } = await supabaseAdmin
        .from('meetings')
        .update(updates)
        .eq('meeting_id', meetingId)
        .select()
        .single();
    if (error || !data)
        throw new Error(error?.message ?? 'Update failed');
    return data;
};
// ── Open attendance (supports opening outside preset time / reopening) ─
export const openAttendance = async (meetingId, requesterId, requesterRole) => {
    const { data: meeting, error } = await supabaseAdmin
        .from('meetings')
        .select('created_by, attendance_status, title, attendance_open_time, attendance_close_time')
        .eq('meeting_id', meetingId)
        .single();
    if (error || !meeting)
        throw new Error('Meeting not found');
    if (requesterRole !== 'ict_admin' && meeting.created_by !== requesterId) {
        throw new Error('Only the meeting organizer or ICT Admin can open attendance');
    }
    if (meeting.attendance_status === 'open')
        throw new Error('Attendance is already open');
    const now = new Date();
    const currentClose = new Date(meeting.attendance_close_time);
    const currentOpen = new Date(meeting.attendance_open_time);
    // If opening outside preset time, adjust open and close times so attendance is immediately valid
    let newOpenTime = meeting.attendance_open_time;
    let newCloseTime = meeting.attendance_close_time;
    if (now < currentOpen || now >= currentClose) {
        newOpenTime = now.toISOString();
        // If current close time has passed or is now, extend by 2 hours
        if (now >= currentClose) {
            newCloseTime = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();
        }
    }
    const { error: updateErr } = await supabaseAdmin
        .from('meetings')
        .update({
        attendance_status: 'open',
        attendance_open_time: newOpenTime,
        attendance_close_time: newCloseTime,
        updated_at: now.toISOString(),
    })
        .eq('meeting_id', meetingId);
    if (updateErr)
        throw new Error(updateErr.message);
    // Notify organizer by email (fire-and-forget)
    const { data: organizer } = await supabaseAdmin
        .from('profiles')
        .select('email, full_name')
        .eq('id', meeting.created_by)
        .single();
    if (organizer) {
        const tpl = templates.attendanceOpened(organizer.full_name, meeting.title);
        sendMail({ to: organizer.email, subject: tpl.subject, html: tpl.html }).catch(() => { });
    }
};
// ── Extend attendance ─────────────────────────────────────────────────
export const extendAttendance = async (meetingId, minutes, requesterId, requesterRole) => {
    const { data: meeting, error } = await supabaseAdmin
        .from('meetings')
        .select('created_by, attendance_status, attendance_close_time, title')
        .eq('meeting_id', meetingId)
        .single();
    if (error || !meeting)
        throw new Error('Meeting not found');
    if (requesterRole !== 'ict_admin' && meeting.created_by !== requesterId) {
        throw new Error('Only the meeting organizer or ICT Admin can extend attendance');
    }
    const now = new Date();
    const currentClose = new Date(meeting.attendance_close_time);
    const baseTime = currentClose > now ? currentClose : now;
    const newCloseTime = new Date(baseTime.getTime() + minutes * 60 * 1000).toISOString();
    const { data: updated, error: updateErr } = await supabaseAdmin
        .from('meetings')
        .update({
        attendance_status: 'open', // Re-open or keep open
        attendance_close_time: newCloseTime,
        updated_at: now.toISOString(),
    })
        .eq('meeting_id', meetingId)
        .select()
        .single();
    if (updateErr)
        throw new Error(updateErr.message);
    return updated;
};
// ── Close attendance ──────────────────────────────────────────────────
export const closeAttendance = async (meetingId, requesterId, requesterRole) => {
    const { data: meeting, error } = await supabaseAdmin
        .from('meetings')
        .select('created_by, attendance_status, title')
        .eq('meeting_id', meetingId)
        .single();
    if (error || !meeting)
        throw new Error('Meeting not found');
    if (requesterRole !== 'ict_admin' && meeting.created_by !== requesterId) {
        throw new Error('Only the meeting organizer or ICT Admin can close attendance');
    }
    if (meeting.attendance_status !== 'open')
        throw new Error('Attendance is not currently open');
    const { error: updateErr } = await supabaseAdmin
        .from('meetings')
        .update({ attendance_status: 'closed', updated_at: new Date().toISOString() })
        .eq('meeting_id', meetingId);
    if (updateErr)
        throw new Error(updateErr.message);
    // Get total count for email
    const { data: summary } = await supabaseAdmin
        .from('vw_meeting_attendance_summary')
        .select('total_attendance')
        .eq('meeting_id', meetingId)
        .single();
    // Notify organizer (fire-and-forget)
    const { data: organizer } = await supabaseAdmin
        .from('profiles')
        .select('email, full_name')
        .eq('id', meeting.created_by)
        .single();
    if (organizer) {
        const tpl = templates.attendanceClosed(organizer.full_name, meeting.title, summary?.total_attendance ?? 0);
        sendMail({ to: organizer.email, subject: tpl.subject, html: tpl.html }).catch(() => { });
    }
};
// ── Send Multi-Day / Daily Attendance Reminders via Resend ─────────────
export const sendMeetingReminders = async (meetingId, options, requesterId, requesterRole) => {
    const { data: meeting, error } = await supabaseAdmin
        .from('meetings')
        .select('*, profiles:created_by(email, full_name)')
        .eq('meeting_id', meetingId)
        .single();
    if (error || !meeting)
        throw new Error('Meeting not found');
    if (requesterRole !== 'ict_admin' && meeting.created_by !== requesterId) {
        throw new Error('Only the meeting organizer or ICT Admin can send reminders');
    }
    // Get recipient emails from parameters or registered staff
    let recipientList = [];
    if (options.emails && options.emails.length > 0) {
        recipientList = options.emails.map(e => e.trim().toLowerCase()).filter(Boolean);
    }
    if (recipientList.length === 0) {
        const { data: staffProfiles } = await supabaseAdmin
            .from('profiles')
            .select('email')
            .eq('is_active', true)
            .limit(100);
        if (staffProfiles) {
            recipientList = staffProfiles.map(p => p.email).filter(Boolean);
        }
    }
    if (recipientList.length === 0) {
        throw new Error('No recipient email addresses found to send reminders to.');
    }
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const attendanceUrl = meeting.attendance_url || `${frontendUrl}/attend/${meeting.meeting_id}`;
    const meetingPin = meeting.meeting_pin || meeting.pin || '';
    const dayLabel = options.dayLabel || 'Session';
    const dateStr = options.dateStr || meeting.meeting_date;
    let sentCount = 0;
    for (const email of recipientList) {
        try {
            const tpl = templates.multiDayAttendanceReminder(email.split('@')[0], meeting.title, dayLabel, dateStr, meetingPin, attendanceUrl, meeting.venue);
            await sendMail({ to: email, subject: tpl.subject, html: tpl.html });
            sentCount++;
        }
        catch (mailErr) {
            console.warn(`[Reminder Send Failed for ${email}]:`, mailErr);
        }
    }
    return { success: true, sentCount, totalRecipients: recipientList.length };
};
// ── Delete meeting ────────────────────────────────────────────────────
export const deleteMeeting = async (meetingId, requesterId, requesterRole) => {
    // Ownership check
    const { data: existing, error: fetchErr } = await supabaseAdmin
        .from('meetings')
        .select('created_by, title')
        .eq('meeting_id', meetingId)
        .single();
    if (fetchErr || !existing)
        throw new Error('Meeting not found');
    if (requesterRole !== 'ict_admin' && existing.created_by !== requesterId) {
        throw new Error('You can only delete meetings you created');
    }
    // Delete associated attendances and reports
    await Promise.all([
        supabaseAdmin.from('attendance_staff').delete().eq('meeting_id', meetingId),
        supabaseAdmin.from('attendance_visitor').delete().eq('meeting_id', meetingId),
        supabaseAdmin.from('attendance_records').delete().eq('meeting_id', meetingId),
        supabaseAdmin.from('reports').delete().eq('meeting_id', meetingId),
    ]);
    const { error: delErr } = await supabaseAdmin
        .from('meetings')
        .delete()
        .eq('meeting_id', meetingId);
    if (delErr)
        throw new Error(delErr.message);
    return { success: true, message: `Meeting "${existing.title}" deleted successfully` };
};
