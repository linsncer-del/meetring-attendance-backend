// =====================================================================
// KMTAMS — Shared TypeScript Types
// =====================================================================

export type AppRole = 'ict_admin' | 'hr_officer' | 'meeting_creator'

export type MeetingType = 'physical' | 'virtual' | 'hybrid'

export type AttendanceStatus = 'not_started' | 'open' | 'closed'

export type VisitorPurpose =
  | 'guest'
  | 'consultant'
  | 'contractor'
  | 'partner'
  | 'trainer'
  | 'auditor'
  | 'other'

export type ReportStatus = 'draft' | 'submitted_to_hr' | 'archived'

export type NotificationType =
  | 'attendance_opened'
  | 'attendance_closed'
  | 'report_generated'
  | 'report_submitted'
  | 'report_received_by_hr'
  | 'training_completed'
  | 'awaiting_review'

export type AuditAction =
  | 'login'
  | 'logout'
  | 'password_change'
  | 'meeting_created'
  | 'meeting_updated'
  | 'attendance_opened'
  | 'attendance_closed'
  | 'attendance_submitted'
  | 'report_generated'
  | 'report_submitted_to_hr'
  | 'user_created'
  | 'user_disabled'
  | 'user_password_reset'
  | 'other'

// ── Database row shapes ──────────────────────────────────────────────

export interface Department {
  department_id: string
  department_code: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  full_name: string
  email: string
  role: AppRole
  department_id: string | null
  is_active: boolean
  must_change_password: boolean
  last_login: string | null
  created_at: string
  updated_at: string
}

export interface Meeting {
  meeting_id: string
  title: string
  description: string | null
  meeting_type: MeetingType
  venue: string | null
  virtual_link: string | null
  meeting_date: string
  start_time: string
  end_time: string
  attendance_open_time: string
  attendance_close_time: string
  department_id: string | null
  created_by: string
  meeting_pin: string
  qr_code_url: string | null
  attendance_url: string | null
  attendance_status: AttendanceStatus
  created_at: string
  updated_at: string
}

export interface AttendanceStaff {
  attendance_id: string
  meeting_id: string
  full_name: string
  designation: string
  department_id: string | null
  signature_data: string
  submitted_at: string
  ip_address: string | null
}

export interface AttendanceVisitor {
  attendance_id: string
  meeting_id: string
  full_name: string
  organization: string
  position_title: string | null
  purpose: VisitorPurpose
  signature_data: string
  submitted_at: string
  ip_address: string | null
}

export interface Report {
  report_id: string
  meeting_id: string
  generated_by: string
  generated_at: string
  total_staff: number
  total_visitors: number
  total_attendance: number
  attendance_percentage: number | null
  status: ReportStatus
  submitted_at: string | null
  file_path: string | null
}

export interface Notification {
  notification_id: string
  user_id: string
  related_meeting_id: string | null
  related_report_id: string | null
  message: string
  notification_type: NotificationType
  is_read: boolean
  created_at: string
}

export interface AuditLog {
  log_id: number
  user_id: string | null
  action: AuditAction
  details: string | null
  ip_address: string | null
  created_at: string
}

// ── Hono context variable types ──────────────────────────────────────

export interface HonoVariables {
  user: Profile
  token: string
}

// ── Utility helpers ──────────────────────────────────────────────────

export interface PaginationParams {
  page: number
  limit: number
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}
