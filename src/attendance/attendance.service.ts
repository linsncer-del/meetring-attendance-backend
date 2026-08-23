import { supabaseAdmin } from '../config/supabase.js'
import type { SubmitAttendanceInput } from '../utils/validators.js'

// ── Validate PIN & Status (PUBLIC — called before form access) ────────

export const validateMeetingPin = async (
  meetingId: string,
  meetingPin: string
): Promise<{ valid: boolean; message: string; meetingTitle: string }> => {
  // 1. Fetch meeting info
  const { data: meeting, error: meetingErr } = await supabaseAdmin
    .from('meetings')
    .select('title, meeting_pin, attendance_status, attendance_open_time, attendance_close_time')
    .eq('meeting_id', meetingId)
    .single()

  if (meetingErr || !meeting) {
    throw new Error('Meeting not found or link is invalid')
  }

  // 2. Check attendance status
  if (meeting.attendance_status === 'not_started') {
    throw new Error('Attendance has not been opened yet. Please wait for the organizer to activate the register.')
  }

  if (meeting.attendance_status === 'closed') {
    throw new Error('Attendance for this meeting is closed. Submissions are no longer accepted.')
  }

  // 3. Validate PIN
  if (meeting.meeting_pin !== meetingPin.trim()) {
    throw new Error('Invalid Meeting PIN. Please enter the correct 6-digit PIN provided by the organizer.')
  }

  return { valid: true, message: 'PIN verified successfully', meetingTitle: meeting.title }
}

// ── Submit attendance (PUBLIC — called by participants) ───────────────

export const submitAttendance = async (
  input: SubmitAttendanceInput,
  ipAddress?: string
): Promise<{ type: 'staff' | 'visitor'; attendance_id: string }> => {
  const { meeting_id, meeting_pin } = input

  // 1. Fetch and validate meeting
  const { data: meeting, error: meetingErr } = await supabaseAdmin
    .from('meetings')
    .select('meeting_pin, attendance_status, attendance_open_time, attendance_close_time, form_config')
    .eq('meeting_id', meeting_id)
    .single()

  if (meetingErr || !meeting) throw new Error('Meeting not found')

  // 2. Validate PIN
  if (meeting.meeting_pin !== meeting_pin.trim()) {
    throw new Error('Invalid Meeting PIN. Please check and try again.')
  }

  // 3. Check attendance status
  if (meeting.attendance_status !== 'open') {
    if (meeting.attendance_status === 'not_started') {
      throw new Error('Attendance has not been opened yet. Please wait for the organizer to open attendance.')
    }
    throw new Error('Attendance has been closed for this meeting.')
  }

  // 3b. Reject visitor submissions if the organizer disabled external sign-in
  const allowVisitors = (meeting.form_config as any)?.allowVisitors !== false
  if (input.participant_type === 'visitor' && !allowVisitors) {
    throw new Error('External visitor sign-in is disabled for this meeting.')
  }

  // 4. Insert into the appropriate table
  if (input.participant_type === 'staff') {
    const insertPayload: any = {
      meeting_id,
      full_name: input.full_name,
      designation: input.designation,
      department_id: input.department_id,
      signature_data: input.signature_data,
      ip_address: ipAddress ?? null,
    }
    if (input.custom_responses) {
      insertPayload.custom_responses = input.custom_responses
    }

    const { data, error } = await supabaseAdmin
      .from('attendance_staff')
      .insert(insertPayload)
      .select('attendance_id')
      .single()

    if (error) {
      if (error.code === '23505') {
        throw new Error('You have already registered attendance for this session.')
      }
      if (error.message?.includes('custom_responses')) {
        delete insertPayload.custom_responses
        const retryRes = await supabaseAdmin
          .from('attendance_staff')
          .insert(insertPayload)
          .select('attendance_id')
          .single()
        if (retryRes.error) throw new Error(retryRes.error.message)
        return { type: 'staff', attendance_id: retryRes.data.attendance_id }
      }
      throw new Error(error.message)
    }

    return { type: 'staff', attendance_id: data.attendance_id }
  } else {
    // visitor
    const insertPayload: any = {
      meeting_id,
      full_name: input.full_name,
      organization: input.organization,
      position_title: input.position_title ?? null,
      purpose: input.purpose,
      signature_data: input.signature_data,
      ip_address: ipAddress ?? null,
    }
    if (input.custom_responses) {
      insertPayload.custom_responses = input.custom_responses
    }

    const { data, error } = await supabaseAdmin
      .from('attendance_visitor')
      .insert(insertPayload)
      .select('attendance_id')
      .single()

    if (error) {
      if (error.code === '23505') {
        throw new Error('You have already registered attendance for this session.')
      }
      if (error.message?.includes('custom_responses')) {
        delete insertPayload.custom_responses
        const retryRes = await supabaseAdmin
          .from('attendance_visitor')
          .insert(insertPayload)
          .select('attendance_id')
          .single()
        if (retryRes.error) throw new Error(retryRes.error.message)
        return { type: 'visitor', attendance_id: retryRes.data.attendance_id }
      }
      throw new Error(error.message)
    }
    return { type: 'visitor', attendance_id: data.attendance_id }
  }
}

// ── Get all attendees for a meeting ───────────────────────────────────

export const getAttendanceByMeeting = async (meetingId: string) => {
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
  ])

  if (staffRes.error) throw new Error(staffRes.error.message)
  if (visitorRes.error) throw new Error(visitorRes.error.message)

  return {
    staff: staffRes.data,
    visitors: visitorRes.data,
    total_staff: staffRes.data.length,
    total_visitors: visitorRes.data.length,
    total: staffRes.data.length + visitorRes.data.length,
  }
}

// ── Get meeting info for public attendance page (no auth) ─────────────

export const getPublicMeetingInfo = async (meetingId: string) => {
  const { data, error } = await supabaseAdmin
    .from('meetings')
    .select('meeting_id, title, description, meeting_type, venue, meeting_date, start_time, end_time, attendance_status, attendance_open_time, attendance_close_time, department_id, department_label, form_config, departments(name)')
    .eq('meeting_id', meetingId)
    .single()

  if (error || !data) throw new Error('Meeting not found')
  return data
}
