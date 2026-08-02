import { supabaseAdmin } from '../config/supabase.js';
// ── Submit attendance (PUBLIC — called by participants) ───────────────
export const submitAttendance = async (input, ipAddress) => {
    const { meeting_id, meeting_pin } = input;
    // 1. Fetch and validate meeting
    const { data: meeting, error: meetingErr } = await supabaseAdmin
        .from('meetings')
        .select('meeting_pin, attendance_status, attendance_open_time, attendance_close_time')
        .eq('meeting_id', meeting_id)
        .single();
    if (meetingErr || !meeting)
        throw new Error('Meeting not found');
    // 2. Validate PIN
    if (meeting.meeting_pin !== meeting_pin) {
        throw new Error('Invalid Meeting PIN. Please check and try again.');
    }
    // 3. Check attendance window
    const now = new Date();
    const openTime = new Date(meeting.attendance_open_time);
    const closeTime = new Date(meeting.attendance_close_time);
    if (meeting.attendance_status !== 'open') {
        if (meeting.attendance_status === 'not_started') {
            throw new Error('Attendance has not been opened yet. Please wait for the organizer to open attendance.');
        }
        throw new Error('Attendance has been closed for this meeting.');
    }
    if (now < openTime) {
        throw new Error(`Attendance will open at ${openTime.toLocaleTimeString('en-KE')}`);
    }
    if (now > closeTime) {
        throw new Error('The attendance window has closed.');
    }
    // 4. Insert into the appropriate table
    if (input.participant_type === 'staff') {
        const { data, error } = await supabaseAdmin
            .from('attendance_staff')
            .insert({
            meeting_id,
            full_name: input.full_name,
            designation: input.designation,
            department_id: input.department_id,
            signature_data: input.signature_data,
            ip_address: ipAddress ?? null,
        })
            .select('attendance_id')
            .single();
        if (error) {
            if (error.code === '23505') {
                throw new Error('You have already registered attendance for this meeting.');
            }
            throw new Error(error.message);
        }
        return { type: 'staff', attendance_id: data.attendance_id };
    }
    else {
        // visitor
        const { data, error } = await supabaseAdmin
            .from('attendance_visitor')
            .insert({
            meeting_id,
            full_name: input.full_name,
            organization: input.organization,
            position_title: input.position_title ?? null,
            purpose: input.purpose,
            signature_data: input.signature_data,
            ip_address: ipAddress ?? null,
        })
            .select('attendance_id')
            .single();
        if (error)
            throw new Error(error.message);
        return { type: 'visitor', attendance_id: data.attendance_id };
    }
};
// ── Get all attendees for a meeting ───────────────────────────────────
export const getAttendanceByMeeting = async (meetingId) => {
    const [staffRes, visitorRes] = await Promise.all([
        supabaseAdmin
            .from('attendance_staff')
            .select('*, departments(name, department_code)')
            .eq('meeting_id', meetingId)
            .order('submitted_at', { ascending: true }),
        supabaseAdmin
            .from('attendance_visitor')
            .select('*')
            .eq('meeting_id', meetingId)
            .order('submitted_at', { ascending: true }),
    ]);
    if (staffRes.error)
        throw new Error(staffRes.error.message);
    if (visitorRes.error)
        throw new Error(visitorRes.error.message);
    return {
        staff: staffRes.data,
        visitors: visitorRes.data,
        total_staff: staffRes.data.length,
        total_visitors: visitorRes.data.length,
        total: staffRes.data.length + visitorRes.data.length,
    };
};
// ── Get meeting info for public attendance page (no auth) ─────────────
export const getPublicMeetingInfo = async (meetingId) => {
    const { data, error } = await supabaseAdmin
        .from('meetings')
        .select('meeting_id, title, meeting_type, venue, meeting_date, start_time, end_time, attendance_status, attendance_open_time, attendance_close_time, department_id, departments(name)')
        .eq('meeting_id', meetingId)
        .single();
    if (error || !data)
        throw new Error('Meeting not found');
    return data;
};
