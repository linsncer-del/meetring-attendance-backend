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
  | 'meeting_deleted'
  | 'attendance_opened'
  | 'attendance_closed'
  | 'attendance_submitted'
  | 'report_generated'
  | 'report_submitted_to_hr'
  | 'user_created'
  | 'user_disabled'
  | 'user_password_reset'
  | 'template_uploaded'
  | 'template_updated'
  | 'document_generated'
  | 'attendance_reminders_sent'
  | 'asset_uploaded'
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

// ── Document Platform ────────────────────────────────────────────────

export interface OrganizationProfile {
  id: string
  name: string
  short_name: string | null
  logo_url: string | null
  address: string | null
  phone: string | null
  email: string | null
  website: string | null
  vision: string | null
  mission: string | null
  core_values: string | null
  stamp_url: string | null
  seal_url: string | null
  watermark_url: string | null
  created_at: string
  updated_at: string
}

export interface DocumentTemplate {
  template_id: string
  name: string
  description: string | null
  category: string
  is_default: boolean
  is_active: boolean
  current_version: number
  created_by: string
  created_at: string
  updated_at: string
}

export interface TemplateVersion {
  version_id: string
  template_id: string
  version_number: number
  file_path: string
  file_size: number | null
  metadata: TemplateMeta | null
  changelog: string | null
  created_by: string
  created_at: string
}

export interface TemplateMeta {
  headers: number
  footers: number
  tables: number
  images: number
  placeholders: string[]
  unknownPlaceholders: string[]
  warnings: string[]
}

export interface OrganizationAsset {
  asset_id: string
  name: string
  asset_type: string
  file_path: string
  mime_type: string | null
  file_size: number | null
  uploaded_by: string
  created_at: string
}

export interface GeneratedDocument {
  document_id: string
  meeting_id: string
  template_id: string | null
  version_used: number | null
  file_path: string
  format: string
  document_number: string | null
  generated_by: string
  generated_at: string
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
