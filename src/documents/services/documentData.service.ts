import { supabaseAdmin } from '../../config/supabase.js'
import type { DocumentData } from '../types.js'

export async function getMeetingDocumentData(meetingId: string, generatedBy: string): Promise<DocumentData> {
  // Fetch meeting with all related data
  const { data: meeting, error: meetingError } = await supabaseAdmin
    .from('meetings')
    .select(`
      *,
      departments:department_id(name),
      organizer:created_by(first_name, last_name),
      staff_attendance(
        id, status, type, designation, signature_url,
        users:user_id(first_name, last_name, designation, department_id),
        department:department_id(name)
      ),
      visitor_attendance(
        id, status, type, designation, organization, signature_url,
        visitors:visitor_id(first_name, last_name, designation, organization)
      )
    `)
    .eq('id', meetingId)
    .single()

  if (meetingError) throw new Error(`Failed to fetch meeting data: ${meetingError.message}`)

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
  if (meeting.staff_attendance) {
    for (const p of meeting.staff_attendance) {
      participants.push({
        sno: sno++,
        name: p.users ? `${p.users.first_name} ${p.users.last_name}` : 'Unknown',
        designation: p.designation || (p.users ? p.users.designation : ''),
        organization: orgProfile?.short_name || orgProfile?.name || '',
        department: p.department?.name || (p.users?.department_id ? 'Unknown Dept' : ''), // Ideally resolve user's dept
        signature: p.signature_url || '',
        status: p.status,
        type: 'staff' as const
      })
    }
  }

  // Add visitors
  if (meeting.visitor_attendance) {
    for (const p of meeting.visitor_attendance) {
      participants.push({
        sno: sno++,
        name: p.visitors ? `${p.visitors.first_name} ${p.visitors.last_name}` : 'Unknown',
        designation: p.designation || (p.visitors ? p.visitors.designation : ''),
        organization: p.organization || (p.visitors ? p.visitors.organization : ''),
        department: '',
        signature: p.signature_url || '',
        status: p.status,
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
      date: new Date(meeting.date).toLocaleDateString(),
      time: meeting.time,
      venue: meeting.venue || '',
      type: meeting.meeting_type,
      reference: meeting.reference || '',
      department: meeting.departments?.name || '',
      organizer: meeting.organizer ? `${meeting.organizer.first_name} ${meeting.organizer.last_name}` : 'Unknown',
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
