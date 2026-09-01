import { supabaseAdmin } from '../../config/supabase.js'
import type { DocumentData } from '../types.js'

export async function getMeetingDocumentData(
  meetingId: string,
  generatedBy: string,
  scope: 'all' | 'staff' | 'visitors' = 'all'
): Promise<DocumentData> {
  // Fetch the meeting (with department + organizer embedded in one query
  // instead of a separate round-trip for the organizer profile), the
  // staff/visitor attendance lists, and the org profile all concurrently
  // — none of these four depend on each other's results, so there's no
  // reason to wait on them one at a time.
  const [meetingRes, staffRes, visitorRes, orgProfileRes] = await Promise.all([
    supabaseAdmin
      .from('meetings')
      .select('*, departments(name, department_code), profiles!meetings_created_by_fkey(full_name, email)')
      .eq('meeting_id', meetingId)
      .single(),
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
    supabaseAdmin
      .from('organization_profile')
      .select('*')
      .limit(1)
      .maybeSingle(),
  ])

  const { data: meeting, error: meetingError } = meetingRes
  if (meetingError || !meeting) {
    throw new Error(`Failed to fetch meeting data: ${meetingError?.message || 'Meeting not found'}`)
  }

  const organizerProfile = (meeting as any).profiles as { full_name?: string; email?: string } | null
  const organizerName = organizerProfile?.full_name || 'Meeting Organizer'

  const { data: staffRows, error: staffError } = staffRes
  if (staffError) console.warn(`Failed to fetch staff attendance: ${staffError.message}`)

  const { data: visitorRows, error: visitorError } = visitorRes
  if (visitorError) console.warn(`Failed to fetch visitor attendance: ${visitorError.message}`)

  const { data: orgProfile } = orgProfileRes

  // Combine and format participants according to scope
  let sno = 1
  const participants = []

  // Add staff if scope is 'all' or 'staff'
  if (scope !== 'visitors' && staffRows) {
    for (const p of staffRows) {
      participants.push({
        sno: sno++,
        name: p.full_name || 'Unknown',
        designation: p.designation || '',
        organization: orgProfile?.short_name || orgProfile?.name || 'KeNHA',
        department: (p.departments as any)?.name || '',
        signature: p.signature_data || '',
        status: 'present',
        type: 'staff' as const,
        ...(p.custom_responses || {})
      })
    }
  }

  // Add visitors if scope is 'all' or 'visitors'
  if (scope !== 'staff' && visitorRows) {
    for (const p of visitorRows) {
      participants.push({
        sno: sno++,
        name: p.full_name || 'Unknown',
        designation: p.position_title || '',
        organization: p.organization || '',
        department: '',
        signature: p.signature_data || '',
        status: 'present',
        type: 'visitor' as const,
        ...(p.custom_responses || {})
      })
    }
  }

  const generatedDate = new Date()

  const docData: DocumentData = {
    organization: {
      name: orgProfile?.name || 'Kenya National Highways Authority',
      short_name: orgProfile?.short_name || 'KeNHA',
      logo: orgProfile?.logo_url || '',
      address: orgProfile?.address || '',
      phone: orgProfile?.phone || '',
      email: orgProfile?.email || '',
      website: orgProfile?.website || '',
      vision: orgProfile?.vision || '',
      mission: orgProfile?.mission || '',
      core_values: orgProfile?.core_values || ''
    },
    meeting: {
      title: meeting.title,
      date: meeting.meeting_date ? new Date(meeting.meeting_date).toLocaleDateString('en-GB') : '',
      time: `${meeting.start_time || ''} - ${meeting.end_time || ''}`,
      venue: meeting.venue || '',
      type: meeting.meeting_type,
      reference: (meeting as any).virtual_link || (meeting as any).meeting_pin || '',
      department: (meeting.departments as any)?.name || (meeting as any).department_label || '',
      organizer: organizerName,
      description: (meeting.description || '').replace(/<!--KMTAMS_FORM_CONFIG:[\s\S]*?-->/g, '').trim()
    },
    participants,
    document: {
      number: `DOC-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
      date: generatedDate.toLocaleDateString('en-GB'),
      generated_by: generatedBy
    }
  }

  return docData
}

