import { supabaseAdmin } from '../config/supabase.js'
import { sendMail, templates } from '../config/mailer.js'
import { buildReportHtml, generatePdfFromHtml } from '../utils/pdfReport.js'
import type { Profile } from '../types/index.js'

// ── Generate report ───────────────────────────────────────────────────

export const generateReport = async (meetingId: string, generatedBy: string) => {
  // 1. Fetch meeting + organizer + department
  const { data: meeting, error: meetingErr } = await supabaseAdmin
    .from('meetings')
    .select('*, departments(name, department_code)')
    .eq('meeting_id', meetingId)
    .single()

  if (meetingErr || !meeting) throw new Error('Meeting not found')
  if (meeting.attendance_status === 'not_started') {
    throw new Error('Cannot generate report: attendance has not been opened yet')
  }

  const { data: organizer, error: orgErr } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', meeting.created_by)
    .single()

  if (orgErr || !organizer) throw new Error('Organizer profile not found')

  // 2. Fetch attendance
  const [staffRes, visitorRes] = await Promise.all([
    supabaseAdmin
      .from('attendance_staff')
      .select('*')
      .eq('meeting_id', meetingId)
      .order('submitted_at'),
    supabaseAdmin
      .from('attendance_visitor')
      .select('*')
      .eq('meeting_id', meetingId)
      .order('submitted_at'),
  ])

  const staffList = staffRes.data ?? []
  const visitorList = visitorRes.data ?? []

  // 3. Build department name map for staff
  const deptIds = [...new Set(staffList.map((s: any) => s.department_id).filter(Boolean))]
  let staffDeptMap: Record<string, string> = {}
  if (deptIds.length > 0) {
    const { data: depts } = await supabaseAdmin
      .from('departments')
      .select('department_id, name')
      .in('department_id', deptIds)
    if (depts) {
      staffDeptMap = Object.fromEntries(depts.map((d: any) => [d.department_id, d.name]))
    }
  }

  const totalStaff = staffList.length
  const totalVisitors = visitorList.length
  const totalAttendance = totalStaff + totalVisitors

  // 4. Build HTML and PDF
  const departmentName = (meeting.departments as any)?.name ?? '—'
  const html = buildReportHtml({
    meeting,
    organizer: organizer as Profile,
    departmentName,
    staffList: staffList as any,
    visitorList: visitorList as any,
    staffDeptMap,
  })

  const pdfBuffer = await generatePdfFromHtml(html)

  // 5. Upload PDF to Supabase Storage
  const filePath = `reports/${meetingId}.pdf`
  const { error: uploadErr } = await supabaseAdmin.storage
    .from('kmtams-assets')
    .upload(filePath, pdfBuffer, { contentType: 'application/pdf', upsert: true })

  let storedFilePath: string | null = null
  if (!uploadErr) {
    storedFilePath = filePath
  }

  // 6. Upsert report record
  const { data: report, error: reportErr } = await supabaseAdmin
    .from('reports')
    .upsert(
      {
        meeting_id: meetingId,
        generated_by: generatedBy,
        generated_at: new Date().toISOString(),
        total_staff: totalStaff,
        total_visitors: totalVisitors,
        total_attendance: totalAttendance,
        attendance_percentage: null,
        status: 'draft',
        file_path: storedFilePath,
      },
      { onConflict: 'meeting_id' }
    )
    .select()
    .single()

  if (reportErr) throw new Error(reportErr.message)

  // Return the PDF buffer for direct download as well
  return { report, pdfBuffer, html }
}

// ── List reports ──────────────────────────────────────────────────────

export const listReports = async (
  userId: string,
  role: string,
  page = 1,
  limit = 20,
  status?: string
) => {
  const from = (page - 1) * limit
  const to = from + limit - 1

  let query = supabaseAdmin
    .from('reports')
    .select(
      `*,
       meetings(title, meeting_date, meeting_type, departments(name)),
       profiles!reports_generated_by_fkey(full_name, email)`,
      { count: 'exact' }
    )
    .order('generated_at', { ascending: false })
    .range(from, to)

  // Only the creator or HR/admin can see reports
  if (role === 'meeting_creator') {
    query = query.eq('generated_by', userId)
  }

  if (status) query = query.eq('status', status)

  const { data, error, count } = await query
  if (error) throw new Error(error.message)
  return { reports: data, total: count ?? 0 }
}

// ── Get single report ─────────────────────────────────────────────────

export const getReportById = async (reportId: string) => {
  const { data, error } = await supabaseAdmin
    .from('reports')
    .select(`
      *,
      meetings(*, departments(name, department_code)),
      profiles!reports_generated_by_fkey(full_name, email)
    `)
    .eq('report_id', reportId)
    .single()

  if (error || !data) throw new Error('Report not found')
  return data
}

// ── Get signed download URL ───────────────────────────────────────────

export const getReportDownloadUrl = async (reportId: string): Promise<string> => {
  const { data: report, error } = await supabaseAdmin
    .from('reports')
    .select('file_path')
    .eq('report_id', reportId)
    .single()

  if (error || !report?.file_path) throw new Error('Report file not found')

  const { data: signedUrl, error: urlErr } = await supabaseAdmin.storage
    .from('kmtams-assets')
    .createSignedUrl(report.file_path, 3600) // 1 hour

  if (urlErr || !signedUrl?.signedUrl) throw new Error('Could not generate download URL')
  return signedUrl.signedUrl
}

// ── Submit report to HR ───────────────────────────────────────────────

export const submitToHR = async (reportId: string, submittedBy: string) => {
  const { data: report, error } = await supabaseAdmin
    .from('reports')
    .select('meeting_id, status, total_attendance')
    .eq('report_id', reportId)
    .single()

  if (error || !report) throw new Error('Report not found')
  if (report.status === 'submitted_to_hr') throw new Error('Report already submitted to HR')

  // Update status
  const { error: updateErr } = await supabaseAdmin
    .from('reports')
    .update({
      status: 'submitted_to_hr',
      submitted_at: new Date().toISOString(),
    })
    .eq('report_id', reportId)

  if (updateErr) throw new Error(updateErr.message)

  // Get meeting title and organizer name
  const { data: meeting } = await supabaseAdmin
    .from('meetings')
    .select('title, profiles!meetings_created_by_fkey(full_name, email)')
    .eq('meeting_id', report.meeting_id)
    .single()

  const organizerName = (meeting?.profiles as any)?.full_name ?? 'N/A'
  const meetingTitle = meeting?.title ?? 'N/A'

  // Notify the submitter
  const { data: submitterProfile } = await supabaseAdmin
    .from('profiles')
    .select('full_name')
    .eq('id', submittedBy)
    .single()

  // Create notification for organizer
  await supabaseAdmin.from('notifications').insert({
    user_id: submittedBy,
    related_meeting_id: report.meeting_id,
    related_report_id: reportId,
    message: `Your attendance report for "${meetingTitle}" has been submitted to HR successfully.`,
    notification_type: 'report_submitted',
  })

  // Fetch all HR officers and ICT admins and notify + email them
  const { data: hrUsers } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, email')
    .in('role', ['hr_officer', 'ict_admin'])
    .eq('is_active', true)

  if (hrUsers && hrUsers.length > 0) {
    // Insert notifications for all HR/admin
    const hrNotifications = hrUsers.map((u: any) => ({
      user_id: u.id,
      related_meeting_id: report.meeting_id,
      related_report_id: reportId,
      message: `New attendance report submitted: "${meetingTitle}" by ${organizerName}. Total: ${report.total_attendance} attendees.`,
      notification_type: 'report_received_by_hr',
    }))
    await supabaseAdmin.from('notifications').insert(hrNotifications)

    // Send emails (fire-and-forget)
    for (const hrUser of hrUsers) {
      const tpl = templates.reportSubmittedToHR(
        hrUser.full_name,
        meetingTitle,
        organizerName,
        report.total_attendance,
        reportId
      )
      sendMail({ to: hrUser.email, subject: tpl.subject, html: tpl.html }).catch(() => {})
    }
  }
}

// ── Archive report (HR only) ──────────────────────────────────────────

export const archiveReport = async (reportId: string) => {
  const { error } = await supabaseAdmin
    .from('reports')
    .update({ status: 'archived' })
    .eq('report_id', reportId)

  if (error) throw new Error(error.message)
}
