import { supabaseAdmin } from '../config/supabase.js';
import { generateUniquePinForDate } from '../utils/pin.js';
import { buildAttendanceUrl, generateQRCodeBase64 } from '../utils/qrcode.js';
import { sendMail, templates } from '../config/mailer.js';
// ── List meetings ─────────────────────────────────────────────────────
// ── List meetings ─────────────────────────────────────────────────────
export const listMeetings = async (userId, role, page = 1, limit = 20, filters) => {
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    let query = supabaseAdmin
        .from('meetings')
        .select(`*, 
       profiles!meetings_created_by_fkey(full_name, email),
       departments(name, department_code),
       meeting_sessions(*)`, { count: 'exact' })
        .order('start_date', { ascending: false })
        .range(from, to);
    // Meeting creators only see their own meetings; HR and admins see all
    if (role === 'meeting_creator') {
        query = query.eq('created_by', userId);
    }
    if (filters?.meetingType)
        query = query.eq('meeting_type', filters.meetingType);
    if (filters?.departmentId)
        query = query.eq('department_id', filters.departmentId);
    if (filters?.search)
        query = query.ilike('title', `%${filters.search}%`);
    const { data, error, count } = await query;
    if (error)
        throw new Error(error.message);
    return { meetings: data, total: count ?? 0 };
};
// ── Get single meeting ────────────────────────────────────────────────
export const getMeetingById = async (meetingId) => {
    const { data, error } = await supabaseAdmin
        .from('meetings')
        .select(`
      *,
      profiles!meetings_created_by_fkey(full_name, email),
      departments(name, department_code),
      meeting_sessions(*)
    `)
        .eq('meeting_id', meetingId)
        .single();
    if (error || !data)
        throw new Error('Meeting not found');
    // Sort sessions by session_number
    if (data.meeting_sessions && Array.isArray(data.meeting_sessions)) {
        data.sessions = data.meeting_sessions.sort((a, b) => a.session_number - b.session_number);
    }
    return data;
};
// ── Get live attendance summary ───────────────────────────────────────
export const getMeetingLiveSummary = async (meetingId) => {
    const { data, error } = await supabaseAdmin
        .from('vw_meeting_attendance_summary')
        .select('*')
        .eq('meeting_id', meetingId);
    if (error || !data)
        throw new Error('Meeting not found');
    return data;
};
// ── Create meeting ────────────────────────────────────────────────────
export const createMeeting = async (input, createdBy) => {
    // Determine sessions: use input.sessions array or fallback to single session from legacy fields
    let sessionsToCreate = input.sessions || [];
    if (sessionsToCreate.length === 0 && input.meeting_date) {
        sessionsToCreate = [{
                session_date: input.meeting_date,
                session_number: 1,
                start_time: input.start_time || '09:00',
                end_time: input.end_time || '17:00',
                attendance_open_time: input.attendance_open_time || new Date().toISOString(),
                attendance_close_time: input.attendance_close_time || new Date(Date.now() + 8 * 3600 * 1000).toISOString(),
            }];
    }
    if (sessionsToCreate.length === 0) {
        throw new Error('At least one session is required to create a meeting');
    }
    // Calculate start_date & end_date
    const sortedDates = sessionsToCreate.map(s => s.session_date).sort();
    const startDate = input.start_date || sortedDates[0];
    const endDate = input.end_date || sortedDates[sortedDates.length - 1];
    // Generate or validate PIN
    let pin;
    if (input.meeting_pin && input.meeting_pin.trim() !== '') {
        const { data: existing } = await supabaseAdmin
            .from('meetings')
            .select('meeting_id')
            .eq('meeting_pin', input.meeting_pin)
            .eq('start_date', startDate)
            .maybeSingle();
        if (existing)
            throw new Error('This PIN is already in use for another meeting starting on this date');
        pin = input.meeting_pin;
    }
    else {
        pin = await generateUniquePinForDate(startDate);
    }
    // Insert meeting row
    const { data: meeting, error } = await supabaseAdmin
        .from('meetings')
        .insert({
        title: input.title,
        description: input.description || null,
        meeting_type: input.meeting_type,
        venue: input.venue || null,
        virtual_link: input.virtual_link || null,
        start_date: startDate,
        end_date: endDate,
        department_id: input.department_id || null,
        created_by: createdBy,
        meeting_pin: pin,
    })
        .select()
        .single();
    if (error)
        throw new Error(error.message);
    // Insert sessions
    const sessionRows = sessionsToCreate.map((s, idx) => ({
        meeting_id: meeting.meeting_id,
        session_date: s.session_date,
        session_number: s.session_number || (idx + 1),
        start_time: s.start_time,
        end_time: s.end_time,
        attendance_open_time: s.attendance_open_time,
        attendance_close_time: s.attendance_close_time,
        attendance_status: 'not_started',
    }));
    const { data: createdSessions, error: sessionErr } = await supabaseAdmin
        .from('meeting_sessions')
        .insert(sessionRows)
        .select();
    if (sessionErr)
        throw new Error(`Failed to create meeting sessions: ${sessionErr.message}`);
    // Generate QR code URL and attendance URL
    const attendanceUrl = buildAttendanceUrl(meeting.meeting_id);
    const qrCodeBase64 = await generateQRCodeBase64(attendanceUrl);
    // Store QR in Supabase Storage
    const qrPath = `qrcodes/${meeting.meeting_id}.png`;
    const qrBuffer = Buffer.from(qrCodeBase64.replace(/^data:image\/png;base64,/, ''), 'base64');
    const { error: storageError } = await supabaseAdmin.storage
        .from('kmtams-assets')
        .upload(qrPath, qrBuffer, { contentType: 'image/png', upsert: true });
    let qrCodeUrl = qrCodeBase64;
    if (!storageError) {
        const { data: publicUrl } = supabaseAdmin.storage
            .from('kmtams-assets')
            .getPublicUrl(qrPath);
        qrCodeUrl = publicUrl.publicUrl;
    }
    const { data: updated, error: updateError } = await supabaseAdmin
        .from('meetings')
        .update({ qr_code_url: qrCodeUrl, attendance_url: attendanceUrl })
        .eq('meeting_id', meeting.meeting_id)
        .select()
        .single();
    if (updateError)
        throw new Error(updateError.message);
    return { ...updated, sessions: createdSessions };
};
// ── Update meeting ────────────────────────────────────────────────────
export const updateMeeting = async (meetingId, input, requesterId, requesterRole) => {
    const { data: existing, error: fetchErr } = await supabaseAdmin
        .from('meetings')
        .select('created_by')
        .eq('meeting_id', meetingId)
        .single();
    if (fetchErr || !existing)
        throw new Error('Meeting not found');
    if (requesterRole !== 'ict_admin' && existing.created_by !== requesterId) {
        throw new Error('You can only update meetings you created');
    }
    const updates = { updated_at: new Date().toISOString() };
    const fields = ['title', 'description', 'meeting_type', 'venue', 'virtual_link', 'start_date', 'end_date', 'department_id'];
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
// ── Open Session Attendance ───────────────────────────────────────────
export const openSessionAttendance = async (sessionId, requesterId, requesterRole) => {
    const { data: session, error } = await supabaseAdmin
        .from('meeting_sessions')
        .select('*, meetings(title, created_by)')
        .eq('session_id', sessionId)
        .single();
    if (error || !session)
        throw new Error('Session not found');
    const meeting = session.meetings;
    if (requesterRole !== 'ict_admin' && meeting?.created_by !== requesterId) {
        throw new Error('Only the meeting organizer or ICT Admin can open attendance');
    }
    if (session.attendance_status === 'open')
        throw new Error('Attendance for this session is already open');
    const { error: updateErr } = await supabaseAdmin
        .from('meeting_sessions')
        .update({ attendance_status: 'open', updated_at: new Date().toISOString() })
        .eq('session_id', sessionId);
    if (updateErr)
        throw new Error(updateErr.message);
    // Notify organizer by email
    if (meeting?.created_by) {
        const { data: organizer } = await supabaseAdmin
            .from('profiles')
            .select('email, full_name')
            .eq('id', meeting.created_by)
            .single();
        if (organizer) {
            const tpl = templates.attendanceOpened(organizer.full_name, `${meeting.title} (Session ${session.session_number} - ${session.session_date})`);
            sendMail({ to: organizer.email, subject: tpl.subject, html: tpl.html }).catch(() => { });
        }
    }
};
// ── Close Session Attendance ──────────────────────────────────────────
export const closeSessionAttendance = async (sessionId, requesterId, requesterRole) => {
    const { data: session, error } = await supabaseAdmin
        .from('meeting_sessions')
        .select('*, meetings(title, created_by)')
        .eq('session_id', sessionId)
        .single();
    if (error || !session)
        throw new Error('Session not found');
    const meeting = session.meetings;
    if (requesterRole !== 'ict_admin' && meeting?.created_by !== requesterId) {
        throw new Error('Only the meeting organizer or ICT Admin can close attendance');
    }
    if (session.attendance_status !== 'open')
        throw new Error('Attendance for this session is not open');
    const { error: updateErr } = await supabaseAdmin
        .from('meeting_sessions')
        .update({ attendance_status: 'closed', updated_at: new Date().toISOString() })
        .eq('session_id', sessionId);
    if (updateErr)
        throw new Error(updateErr.message);
};
// ── Open Legacy Meeting Attendance (Opens first session) ──────────────
export const openAttendance = async (meetingId, requesterId, requesterRole) => {
    const { data: sessions } = await supabaseAdmin
        .from('meeting_sessions')
        .select('session_id')
        .eq('meeting_id', meetingId)
        .order('session_number', { ascending: true });
    if (sessions && sessions.length > 0) {
        await openSessionAttendance(sessions[0].session_id, requesterId, requesterRole);
    }
    else {
        throw new Error('No sessions found for this meeting');
    }
};
// ── Close Legacy Meeting Attendance ────────────────────────────────────
export const closeAttendance = async (meetingId, requesterId, requesterRole) => {
    const { data: sessions } = await supabaseAdmin
        .from('meeting_sessions')
        .select('session_id')
        .eq('meeting_id', meetingId)
        .eq('attendance_status', 'open');
    if (sessions && sessions.length > 0) {
        for (const s of sessions) {
            await closeSessionAttendance(s.session_id, requesterId, requesterRole);
        }
    }
};
