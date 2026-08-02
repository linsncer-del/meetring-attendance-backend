import { supabaseAdmin } from '../config/supabase.js'
import { generateUniquePinForDate } from '../utils/pin.js'
import { buildAttendanceUrl, generateQRCodeBase64 } from '../utils/qrcode.js'
import { sendMail, templates } from '../config/mailer.js'
import type { Meeting } from '../types/index.js'
import type { CreateMeetingInput, UpdateMeetingInput } from '../utils/validators.js'

// ── List meetings ─────────────────────────────────────────────────────

export const listMeetings = async (
  userId: string,
  role: string,
  page = 1,
  limit = 20,
  filters?: { status?: string; meetingType?: string; search?: string; departmentId?: string }
) => {
  const from = (page - 1) * limit
  const to = from + limit - 1

  let query = supabaseAdmin
    .from('meetings')
    .select(
      `*, 
       profiles!meetings_created_by_fkey(full_name, email),
       departments(name, department_code)`,
      { count: 'exact' }
    )
    .order('meeting_date', { ascending: false })
    .range(from, to)

  // Meeting creators only see their own meetings; HR and admins see all
  if (role === 'meeting_creator') {
    query = query.eq('created_by', userId)
  }

  if (filters?.status) query = query.eq('attendance_status', filters.status)
  if (filters?.meetingType) query = query.eq('meeting_type', filters.meetingType)
  if (filters?.departmentId) query = query.eq('department_id', filters.departmentId)
  if (filters?.search) query = query.ilike('title', `%${filters.search}%`)

  const { data, error, count } = await query
  if (error) throw new Error(error.message)
  return { meetings: data as Meeting[], total: count ?? 0 }
}

// ── Get single meeting ────────────────────────────────────────────────

export const getMeetingById = async (meetingId: string) => {
  const { data, error } = await supabaseAdmin
    .from('meetings')
    .select(`
      *,
      profiles!meetings_created_by_fkey(full_name, email),
      departments(name, department_code)
    `)
    .eq('meeting_id', meetingId)
    .single()

  if (error || !data) throw new Error('Meeting not found')
  return data
}

// ── Get live attendance summary ───────────────────────────────────────

export const getMeetingLiveSummary = async (meetingId: string) => {
  const { data, error } = await supabaseAdmin
    .from('vw_meeting_attendance_summary')
    .select('*')
    .eq('meeting_id', meetingId)
    .single()

  if (error || !data) throw new Error('Meeting not found')
  return data
}

// ── Create meeting ────────────────────────────────────────────────────

export const createMeeting = async (
  input: CreateMeetingInput,
  createdBy: string
): Promise<Meeting> => {
  // Generate or validate PIN
  let pin: string
  if (input.meeting_pin && input.meeting_pin.trim() !== '') {
    // Check uniqueness for custom PIN
    const { data: existing } = await supabaseAdmin
      .from('meetings')
      .select('meeting_id')
      .eq('meeting_pin', input.meeting_pin)
      .eq('meeting_date', input.meeting_date)
      .maybeSingle()

    if (existing) throw new Error('This PIN is already in use for another meeting on this date')
    pin = input.meeting_pin
  } else {
    pin = await generateUniquePinForDate(input.meeting_date)
  }

  // Build attendance URL (based on a meeting_id we generate)
  // We insert first, then update QR after getting the ID
  const { data: meeting, error } = await supabaseAdmin
    .from('meetings')
    .insert({
      title: input.title,
      description: input.description || null,
      meeting_type: input.meeting_type,
      venue: input.venue || null,
      virtual_link: input.virtual_link || null,
      meeting_date: input.meeting_date,
      start_time: input.start_time,
      end_time: input.end_time,
      attendance_open_time: input.attendance_open_time,
      attendance_close_time: input.attendance_close_time,
      department_id: input.department_id || null,
      created_by: createdBy,
      meeting_pin: pin,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  // Generate QR code URL and attendance URL
  const attendanceUrl = buildAttendanceUrl(meeting.meeting_id)
  const qrCodeBase64 = await generateQRCodeBase64(attendanceUrl)

  // Store QR in Supabase Storage (bucket: 'qrcodes')
  const qrPath = `qrcodes/${meeting.meeting_id}.png`
  const qrBuffer = Buffer.from(qrCodeBase64.replace(/^data:image\/png;base64,/, ''), 'base64')

  const { error: storageError } = await supabaseAdmin.storage
    .from('kmtams-assets')
    .upload(qrPath, qrBuffer, { contentType: 'image/png', upsert: true })

  let qrCodeUrl = qrCodeBase64 // fallback to base64 if storage fails
  if (!storageError) {
    const { data: publicUrl } = supabaseAdmin.storage
      .from('kmtams-assets')
      .getPublicUrl(qrPath)
    qrCodeUrl = publicUrl.publicUrl
  }

  // Update record with URLs
  const { data: updated, error: updateError } = await supabaseAdmin
    .from('meetings')
    .update({ qr_code_url: qrCodeUrl, attendance_url: attendanceUrl })
    .eq('meeting_id', meeting.meeting_id)
    .select()
    .single()

  if (updateError) throw new Error(updateError.message)
  return updated as Meeting
}

// ── Update meeting ────────────────────────────────────────────────────

export const updateMeeting = async (
  meetingId: string,
  input: UpdateMeetingInput,
  requesterId: string,
  requesterRole: string
): Promise<Meeting> => {
  // Ownership check
  const { data: existing, error: fetchErr } = await supabaseAdmin
    .from('meetings')
    .select('created_by, attendance_status')
    .eq('meeting_id', meetingId)
    .single()

  if (fetchErr || !existing) throw new Error('Meeting not found')

  if (requesterRole !== 'ict_admin' && existing.created_by !== requesterId) {
    throw new Error('You can only update meetings you created')
  }

  if (existing.attendance_status !== 'not_started') {
    throw new Error('Cannot update a meeting after attendance has been opened')
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  const fields = [
    'title','description','meeting_type','venue','virtual_link',
    'meeting_date','start_time','end_time','attendance_open_time',
    'attendance_close_time','department_id',
  ] as const

  for (const f of fields) {
    if (input[f] !== undefined) updates[f] = input[f]
  }

  const { data, error } = await supabaseAdmin
    .from('meetings')
    .update(updates)
    .eq('meeting_id', meetingId)
    .select()
    .single()

  if (error || !data) throw new Error(error?.message ?? 'Update failed')
  return data as Meeting
}

// ── Open attendance ───────────────────────────────────────────────────

export const openAttendance = async (
  meetingId: string,
  requesterId: string,
  requesterRole: string
) => {
  const { data: meeting, error } = await supabaseAdmin
    .from('meetings')
    .select('created_by, attendance_status, title')
    .eq('meeting_id', meetingId)
    .single()

  if (error || !meeting) throw new Error('Meeting not found')
  if (requesterRole !== 'ict_admin' && meeting.created_by !== requesterId) {
    throw new Error('Only the meeting organizer or ICT Admin can open attendance')
  }
  if (meeting.attendance_status === 'open') throw new Error('Attendance is already open')
  if (meeting.attendance_status === 'closed') throw new Error('Attendance has already been closed')

  const { error: updateErr } = await supabaseAdmin
    .from('meetings')
    .update({ attendance_status: 'open', updated_at: new Date().toISOString() })
    .eq('meeting_id', meetingId)

  if (updateErr) throw new Error(updateErr.message)

  // Notify organizer by email (fire-and-forget)
  const { data: organizer } = await supabaseAdmin
    .from('profiles')
    .select('email, full_name')
    .eq('id', meeting.created_by)
    .single()

  if (organizer) {
    const tpl = templates.attendanceOpened(organizer.full_name, meeting.title)
    sendMail({ to: organizer.email, subject: tpl.subject, html: tpl.html }).catch(() => {})
  }
}

// ── Close attendance ──────────────────────────────────────────────────

export const closeAttendance = async (
  meetingId: string,
  requesterId: string,
  requesterRole: string
) => {
  const { data: meeting, error } = await supabaseAdmin
    .from('meetings')
    .select('created_by, attendance_status, title')
    .eq('meeting_id', meetingId)
    .single()

  if (error || !meeting) throw new Error('Meeting not found')
  if (requesterRole !== 'ict_admin' && meeting.created_by !== requesterId) {
    throw new Error('Only the meeting organizer or ICT Admin can close attendance')
  }
  if (meeting.attendance_status !== 'open') throw new Error('Attendance is not currently open')

  const { error: updateErr } = await supabaseAdmin
    .from('meetings')
    .update({ attendance_status: 'closed', updated_at: new Date().toISOString() })
    .eq('meeting_id', meetingId)

  if (updateErr) throw new Error(updateErr.message)

  // Get total count for email
  const { data: summary } = await supabaseAdmin
    .from('vw_meeting_attendance_summary')
    .select('total_attendance')
    .eq('meeting_id', meetingId)
    .single()

  // Notify organizer (fire-and-forget)
  const { data: organizer } = await supabaseAdmin
    .from('profiles')
    .select('email, full_name')
    .eq('id', meeting.created_by)
    .single()

  if (organizer) {
    const tpl = templates.attendanceClosed(
      organizer.full_name,
      meeting.title,
      (summary as any)?.total_attendance ?? 0
    )
    sendMail({ to: organizer.email, subject: tpl.subject, html: tpl.html }).catch(() => {})
  }
}
