import { supabaseAdmin } from '../../config/supabase.js';
export async function getMeetingDocumentData(meetingId, generatedBy, scope = 'all') {
    // 1. Fetch meeting with department info
    const { data: meeting, error: meetingError } = await supabaseAdmin
        .from('meetings')
        .select('*, departments(name, department_code)')
        .eq('meeting_id', meetingId)
        .single();
    if (meetingError || !meeting) {
        throw new Error(`Failed to fetch meeting data: ${meetingError?.message || 'Meeting not found'}`);
    }
    // 2. Fetch organizer profile separately (safe against constraint naming differences)
    let organizerName = 'Meeting Organizer';
    let organizerEmail = '';
    if (meeting.created_by) {
        const { data: organizer } = await supabaseAdmin
            .from('profiles')
            .select('full_name, email')
            .eq('id', meeting.created_by)
            .maybeSingle();
        if (organizer) {
            organizerName = organizer.full_name || organizerName;
            organizerEmail = organizer.email || '';
        }
    }
    // 3. Fetch attendance_staff for this meeting
    const { data: staffRows, error: staffError } = await supabaseAdmin
        .from('attendance_staff')
        .select('*, departments(name, department_code)')
        .eq('meeting_id', meetingId)
        .order('submitted_at', { ascending: true });
    if (staffError)
        console.warn(`Failed to fetch staff attendance: ${staffError.message}`);
    // 4. Fetch attendance_visitor for this meeting
    const { data: visitorRows, error: visitorError } = await supabaseAdmin
        .from('attendance_visitor')
        .select('*')
        .eq('meeting_id', meetingId)
        .order('submitted_at', { ascending: true });
    if (visitorError)
        console.warn(`Failed to fetch visitor attendance: ${visitorError.message}`);
    // 5. Fetch organization profile safely
    const { data: orgProfile } = await supabaseAdmin
        .from('organization_profile')
        .select('*')
        .limit(1)
        .maybeSingle();
    // Combine and format participants according to scope
    let sno = 1;
    const participants = [];
    // Add staff if scope is 'all' or 'staff'
    if (scope !== 'visitors' && staffRows) {
        for (const p of staffRows) {
            participants.push({
                sno: sno++,
                name: p.full_name || 'Unknown',
                designation: p.designation || '',
                organization: orgProfile?.short_name || orgProfile?.name || 'KeNHA',
                department: p.departments?.name || '',
                signature: p.signature_data || '',
                status: 'present',
                type: 'staff'
            });
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
                type: 'visitor'
            });
        }
    }
    const generatedDate = new Date();
    const docData = {
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
            reference: meeting.virtual_link || meeting.meeting_pin || '',
            department: meeting.departments?.name || '',
            organizer: organizerName,
            description: meeting.description || ''
        },
        participants,
        document: {
            number: `DOC-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
            date: generatedDate.toLocaleDateString('en-GB'),
            generated_by: generatedBy
        }
    };
    return docData;
}
