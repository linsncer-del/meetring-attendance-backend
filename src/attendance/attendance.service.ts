import { supabaseAdmin } from '../config/supabase.js'
import type { SubmitAttendanceInput } from '../utils/validators.js'
import { sanitizeIp } from '../utils/ip.js'

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

// Older meetings keep their form config in a comment inside the description
// rather than the form_config column, so check both.
const readFormConfig = (meeting: { form_config?: any; description?: string | null }): any => {
  let config = meeting.form_config
  if (typeof config === 'string') {
    try { config = JSON.parse(config) } catch { config = null }
  }
  if (!config && meeting.description) {
    const match = meeting.description.match(/<!--KMTAMS_FORM_CONFIG:([\s\S]*?)-->/)
    if (match) {
      try { config = JSON.parse(match[1]) } catch { config = null }
    }
  }
  return config ?? {}
}

const isMultiDayMeeting = (meeting: { form_config?: any; description?: string | null }): boolean =>
  Boolean(readFormConfig(meeting)?.isMultiDay)

// ── Multi-day session dates ───────────────────────────────────────────
// Session dates are configured as "DD/MM/YYYY" and stored in the database as
// ISO "YYYY-MM-DD". "Today" is the calendar day in Kenya, never the server's
// own timezone (Render runs in UTC, three hours behind).

const toIsoDate = (value: string): string | null => {
  const s = String(value ?? '').trim()
  let m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  return null
}

const toDisplayDate = (iso: string): string => {
  const [y, mo, d] = iso.split('-')
  return `${d}/${mo}/${y}`
}

const todayInKenya = (): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date())

const nairobiDateOf = (timestamp: string): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(timestamp))

const sessionDatesOf = (meeting: { form_config?: any; description?: string | null }): string[] => {
  const dates: string[] = Array.isArray(readFormConfig(meeting)?.sessionDates) ? readFormConfig(meeting).sessionDates : []
  return [...new Set(dates.map(toIsoDate).filter((d): d is string => Boolean(d)))].sort()
}

const tableFor = (type: 'staff' | 'visitor') => (type === 'staff' ? 'attendance_staff' : 'attendance_visitor')

// ilike for a case-insensitive name match; escape its wildcards so a name is
// matched literally.
const literalNamePattern = (name: string) => name.trim().replace(/[\\%_]/g, c => `\\${c}`)

// Session days this person has already signed for (ISO dates). Rows from
// before the session_date column existed fall back to the Kenya date they
// were submitted on.
const signedSessionDates = async (
  meetingId: string,
  type: 'staff' | 'visitor',
  fullName: string
): Promise<Set<string>> => {
  const table = tableFor(type)
  const pattern = literalNamePattern(fullName)
  let { data, error } = await supabaseAdmin
    .from(table)
    .select('session_date, submitted_at')
    .eq('meeting_id', meetingId)
    .ilike('full_name', pattern)
  if (error?.message?.includes('session_date')) {
    ;({ data, error } = await supabaseAdmin
      .from(table)
      .select('submitted_at')
      .eq('meeting_id', meetingId)
      .ilike('full_name', pattern) as any)
  }
  if (error) throw new Error(error.message)
  return new Set(
    (data ?? []).map((r: any) => r.session_date ? String(r.session_date).slice(0, 10) : nairobiDateOf(r.submitted_at))
  )
}

const loadMeetingForSignIn = async (meetingId: string, meetingPin: string) => {
  const { data: meeting, error } = await supabaseAdmin
    .from('meetings')
    .select('meeting_pin, attendance_status, attendance_open_time, attendance_close_time, form_config, description')
    .eq('meeting_id', meetingId)
    .single()

  if (error || !meeting) throw new Error('Meeting not found')
  if (meeting.meeting_pin !== meetingPin.trim()) {
    throw new Error('Invalid Meeting PIN. Please check and try again.')
  }
  return meeting
}

// ── Days a participant can still sign for (PUBLIC) ────────────────────
// Past and present session days they have not signed yet. Future days are
// never offered; the server's Kenya date decides what "today" is, not the
// participant's phone clock.

export const getSignableDates = async (input: {
  meeting_id: string
  meeting_pin: string
  full_name: string
  participant_type: 'staff' | 'visitor'
}) => {
  const meeting = await loadMeetingForSignIn(input.meeting_id, input.meeting_pin)
  const today = todayInKenya()
  const sessionDays = isMultiDayMeeting(meeting) ? sessionDatesOf(meeting) : []
  const signed = input.full_name.trim().length >= 2
    ? await signedSessionDates(input.meeting_id, input.participant_type, input.full_name)
    : new Set<string>()

  const available = sessionDays.filter(d => d <= today && !signed.has(d))
  return {
    today: toDisplayDate(today),
    available: available.map(toDisplayDate),
    signed: sessionDays.filter(d => signed.has(d)).map(toDisplayDate),
    upcoming: sessionDays.filter(d => d > today).map(toDisplayDate),
  }
}

// ── Submit attendance (PUBLIC — called by participants) ───────────────

export const submitAttendance = async (
  input: SubmitAttendanceInput,
  ipAddress?: string
): Promise<{ type: 'staff' | 'visitor'; attendance_id: string; attendance_ids: string[]; session_dates: string[] }> => {
  const { meeting_id, meeting_pin } = input

  // 1–2. Fetch the meeting and validate the PIN
  const meeting = await loadMeetingForSignIn(meeting_id, meeting_pin)

  // 3. Check attendance status
  if (meeting.attendance_status !== 'open') {
    if (meeting.attendance_status === 'not_started') {
      throw new Error('Attendance has not been opened yet. Please wait for the organizer to open attendance.')
    }
    throw new Error('Attendance has been closed for this meeting.')
  }

  // 3b. Reject visitor submissions if the organizer disabled external sign-in
  const allowVisitors = readFormConfig(meeting)?.allowVisitors !== false
  if (input.participant_type === 'visitor' && !allowVisitors) {
    throw new Error('External visitor sign-in is disabled for this meeting.')
  }

  const table = tableFor(input.participant_type)

  // 3c. Which day(s) this signature is for.
  //  - Single-day meeting: one signature per person, full stop.
  //  - Multi-day meeting: one signature per person per session day. The
  //    participant may pick several past/present days at once (e.g. Monday
  //    and Tuesday, signed on Wednesday); future days are refused.
  let sessionDays: string[] = []
  if (isMultiDayMeeting(meeting)) {
    const configured = new Set(sessionDatesOf(meeting))
    const today = todayInKenya()
    const requested = (input.session_dates?.length ? input.session_dates : [toDisplayDate(today)])
      .map(toIsoDate)
    if (requested.some(d => !d)) throw new Error('One of the selected days is not a valid date.')
    sessionDays = [...new Set(requested as string[])].sort()

    const notInMeeting = sessionDays.filter(d => !configured.has(d))
    if (notInMeeting.length) {
      throw new Error(`${notInMeeting.map(toDisplayDate).join(', ')} ${notInMeeting.length > 1 ? 'are' : 'is'} not a day of this meeting.`)
    }
    const future = sessionDays.filter(d => d > today)
    if (future.length) {
      throw new Error(`You cannot sign for a future day (${future.map(toDisplayDate).join(', ')}).`)
    }
    const signed = await signedSessionDates(meeting_id, input.participant_type, input.full_name)
    const already = sessionDays.filter(d => signed.has(d))
    if (already.length) {
      throw new Error(`You have already signed for ${already.map(toDisplayDate).join(', ')}.`)
    }
  } else {
    const { count } = await supabaseAdmin
      .from(table)
      .select('attendance_id', { count: 'exact', head: true })
      .eq('meeting_id', meeting_id)
      .ilike('full_name', literalNamePattern(input.full_name))
    if (count && count > 0) {
      throw new Error('You have already registered attendance for this meeting.')
    }
  }

  // 4. Insert — one row per session day for a multi-day meeting
  const cleanIp = sanitizeIp(ipAddress)
  const base: Record<string, any> = input.participant_type === 'staff'
    ? {
        meeting_id,
        full_name: input.full_name,
        designation: input.designation,
        department_id: input.department_id,
        signature_data: input.signature_data,
        ip_address: cleanIp,
      }
    : {
        meeting_id,
        full_name: input.full_name,
        organization: input.organization,
        position_title: input.position_title ?? null,
        purpose: input.purpose,
        signature_data: input.signature_data,
        ip_address: cleanIp,
      }
  if (input.custom_responses) base.custom_responses = input.custom_responses

  let rows: Record<string, any>[] = sessionDays.length
    ? sessionDays.map(d => ({ ...base, session_date: d }))
    : [base]

  const insertRows = () => supabaseAdmin.from(table).insert(rows).select('attendance_id')

  let { data, error } = await insertRows()

  // Databases not yet migrated: drop the optional columns and retry, where
  // that still records the right thing.
  if (error?.message?.includes('custom_responses')) {
    rows = rows.map(({ custom_responses, ...rest }) => rest)
    ;({ data, error } = await insertRows())
  }
  if (error?.message?.includes('session_date')) {
    const onlyToday = sessionDays.length === 1 && sessionDays[0] === todayInKenya()
    if (!onlyToday) {
      throw new Error('Signing for earlier days needs a database update. Please ask the organizer to contact ICT.')
    }
    rows = rows.map(({ session_date, ...rest }) => rest)
    ;({ data, error } = await insertRows())
  }

  if (error) {
    if (error.code === '23505') {
      throw new Error('You have already registered attendance for this session.')
    }
    throw new Error(error.message)
  }

  const ids = (data ?? []).map((r: any) => r.attendance_id)
  return {
    type: input.participant_type,
    attendance_id: ids[0],
    attendance_ids: ids,
    session_dates: sessionDays.map(toDisplayDate),
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

// ── Correct an existing attendance record ─────────────────────────────
// Organisers and HR need to fix a misspelt name before the register is filed.
// The signature and its timestamp are the evidence that someone attended, so
// they are never touched here — only the descriptive fields around them.

const CORRECTABLE_FIELDS = {
  staff: ['full_name', 'designation', 'custom_responses'],
  visitor: ['full_name', 'organization', 'position_title', 'custom_responses'],
} as const

export const updateAttendanceRecord = async (
  participantType: 'staff' | 'visitor',
  attendanceId: string,
  input: Record<string, unknown>
) => {
  const table = participantType === 'staff' ? 'attendance_staff' : 'attendance_visitor'

  const patch: Record<string, unknown> = {}
  for (const field of CORRECTABLE_FIELDS[participantType]) {
    if (input[field] !== undefined) patch[field] = input[field]
  }

  if (Object.keys(patch).length === 0) {
    throw new Error(`Those fields cannot be corrected on a ${participantType} record`)
  }

  const run = (body: Record<string, unknown>) =>
    supabaseAdmin
      .from(table)
      .update(body)
      .eq('attendance_id', attendanceId)
      .select('attendance_id, meeting_id, full_name')
      .single()

  let { data, error } = await run(patch)

  // Same fallback the submit path uses: custom_responses may not exist yet.
  if (error && error.message?.includes('custom_responses')) {
    const { custom_responses, ...rest } = patch
    if (Object.keys(rest).length === 0) throw new Error(error.message)
    ;({ data, error } = await run(rest))
  }

  if (error) {
    if (error.code === '23505') {
      throw new Error('Another attendee on this meeting is already recorded under that name.')
    }
    throw new Error(error.message)
  }
  if (!data) throw new Error('Attendance record not found')

  return { ...data, corrected_fields: Object.keys(patch) }
}
