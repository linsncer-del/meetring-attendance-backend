import { supabaseAdmin } from '../../config/supabase.js'
import type { DocumentData } from '../types.js'

export async function getMeetingDocumentData(meetingId: string, generatedBy: string): Promise<DocumentData> {
  // Fetch meeting with department and organizer info
  const { data: meeting, error: meetingError } = await supabaseAdmin
    .from('meetings')
    .select(`
      *,
      departments:department_id(name, department_code),
      organizer:created_by(full_name, email)
    `)
    .eq('meeting_id', meetingId)
    .single()

  if (meetingError || !meeting) throw new Error(`Failed to fetch meeting data: ${meetingError?.message || 'Meeting not found'}`)

  // Fetch attendance_staff for this meeting
  const { data: staffRows, error: staffError } = await supabaseAdmin
    .from('attendance_staff')
    .select('*, departments:department_id(name, department_code)')
    .eq('meeting_id', meetingId)
    .order('submitted_at', { ascending: true })

  if (staffError) throw new Error(`Failed to fetch staff attendance: ${staffError.message}`)

  // Fetch attendance_visitor for this meeting
  const { data: visitorRows, error: visitorError } = await supabaseAdmin
    .from('attendance_visitor')
    .select('*')
    .eq('meeting_id', meetingId)
    .order('submitted_at', { ascending: true })

  if (visitorError) throw new Error(`Failed to fetch visitor attendance: ${visitorError.message}`)

  // Fetch organization profile
  const { data: orgProfile, error: orgError } = await supabaseAdmin
    .from('organization_profile')
    .select('*')
    .limit(1)
    .single()

  if (orgError && orgError.code !== 'PGRST116') {
    throw new Error(`Failed to fetch organization profile: ${orgError.message}`)
  }

  // Combine and format participants
  let sno = 1;
  const participants = []

  // Add staff
  if (staffRows) {
    for (const p of staffRows) {
      participants.push({
        sno: sno++,
        name: p.full_name || 'Unknown',
        designation: p.designation || '',
        organization: orgProfile?.short_name || orgProfile?.name || 'KeNHA',
        department: p.departments?.name || '',
        signature: p.signature_data || '',
        status: 'present',
        type: 'staff' as const
      })
    }
  }

  // Add visitors
  if (visitorRows) {
    for (const p of visitorRows) {
      participants.push({
        sno: sno++,
        name: p.full_name || 'Unknown',
        designation: p.position_title || '',
        organization: p.organization || '',
        department: '',
        signature: p.signature_data || '',
        status: 'present',
        type: 'visitor' as const
      })
    }
  }

  const generatedDate = new Date()

  const docData: DocumentData = {
    organization: {
      name: orgProfile?.name || '',
      short_name: orgProfile?.short_name || '',
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
      date: meeting.meeting_date ? new Date(meeting.meeting_date).toLocaleDateString() : '',
      time: `${meeting.start_time || ''} - ${meeting.end_time || ''}`,
      venue: meeting.venue || '',
      type: meeting.meeting_type,
      reference: meeting.reference || '',
      department: meeting.departments?.name || '',
      organizer: meeting.organizer?.full_name || 'Unknown',
      description: meeting.description || ''
    },
    participants,
    document: {
      number: `DOC-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
      date: generatedDate.toLocaleDateString(),
      generated_by: generatedBy
    }
  }

  return docData
}

