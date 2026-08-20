import { z } from 'zod'

// ── Auth ─────────────────────────────────────────────────────────────

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export const ChangePasswordSchema = z.object({
  new_password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm_password: z.string(),
}).refine(d => d.new_password === d.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
})

export const ResetPasswordRequestSchema = z.object({
  email: z.string().email('Invalid email address'),
})

export const ResetPasswordWithTokenSchema = z.object({
  access_token: z.string().min(1, 'Token is required'),
  new_password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm_password: z.string(),
}).refine(d => d.new_password === d.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
})


// ── Departments ───────────────────────────────────────────────────────

export const CreateDepartmentSchema = z.object({
  department_code: z.string().min(1).max(20),
  name: z.string().min(1).max(150),
  description: z.string().optional(),
})

export const UpdateDepartmentSchema = CreateDepartmentSchema.partial()

// ── Users / Profiles ─────────────────────────────────────────────────

export const CreateUserSchema = z.object({
  full_name: z.string().min(1).max(150),
  email: z.string().email().refine(e => e.endsWith('@kenha.co.ke'), {
    message: 'Must be an official KeNHA email (@kenha.co.ke)',
  }),
  role: z.enum(['ict_admin', 'hr_officer', 'meeting_creator', 'Staff']),
  department_id: z.string().uuid().optional(),
  temp_password: z.string().min(8, 'Temporary password must be at least 8 characters').default('Admin@2056').optional(),
})

export const UpdateUserSchema = z.object({
  full_name: z.string().min(1).max(150).optional(),
  role: z.enum(['ict_admin', 'hr_officer', 'meeting_creator', 'Staff']).optional(),
  department_id: z.string().uuid().nullable().optional(),
})

// ── Meetings ──────────────────────────────────────────────────────────

export const CreateMeetingSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().optional().nullable().or(z.literal('')).transform(v => v || null),
  meeting_type: z.enum(['physical', 'virtual', 'hybrid']),
  venue: z.string().max(255).optional().nullable().or(z.literal('')).transform(v => v || null),
  virtual_link: z.string().optional().nullable().or(z.literal('')).transform(v => v || null),
  meeting_date: z.string().min(1, 'Meeting date is required'),
  start_time: z.string().min(1, 'Start time is required'),
  end_time: z.string().min(1, 'End time is required'),
  attendance_open_time: z.string().min(1, 'Attendance open time is required'),
  attendance_close_time: z.string().min(1, 'Attendance close time is required'),
  department_id: z.string().optional().nullable().or(z.literal('')).transform(v => v || null),
  meeting_pin: z.string().optional().nullable().or(z.literal('')).transform(v => v || null),
  form_config: z.any().optional(),
})

export const UpdateMeetingSchema = CreateMeetingSchema.partial()

export const ExtendAttendanceSchema = z.object({
  minutes: z.number().int().min(1).max(1440).default(30),
})

// ── Attendance — Staff ────────────────────────────────────────────────

export const SubmitStaffAttendanceSchema = z.object({
  meeting_id: z.string().uuid(),
  meeting_pin: z.string().min(1, 'PIN is required'),
  participant_type: z.literal('staff'),
  full_name: z.string().min(1).max(150),
  designation: z.string().max(150).optional().default('Staff'),
  department_id: z.string().uuid().optional().nullable(),
  signature_data: z.string().min(1, 'Digital signature is required'),
  custom_responses: z.record(z.string(), z.any()).optional(),
})

// ── Attendance — Visitor ──────────────────────────────────────────────

export const SubmitVisitorAttendanceSchema = z.object({
  meeting_id: z.string().uuid(),
  meeting_pin: z.string().min(1, 'PIN is required'),
  participant_type: z.literal('visitor'),
  full_name: z.string().min(1).max(150),
  organization: z.string().max(200).optional().default('External / Visitor'),
  position_title: z.string().max(150).optional(),
  purpose: z.enum(['guest', 'consultant', 'contractor', 'partner', 'trainer', 'auditor', 'other']).optional().default('guest'),
  signature_data: z.string().min(1, 'Digital signature is required'),
  custom_responses: z.record(z.string(), z.any()).optional(),
})

export const SubmitAttendanceSchema = z.discriminatedUnion('participant_type', [
  SubmitStaffAttendanceSchema,
  SubmitVisitorAttendanceSchema,
])

export const ValidatePinSchema = z.object({
  meeting_id: z.string().uuid('Invalid meeting ID'),
  meeting_pin: z.string().min(1, 'PIN is required'),
})

// ── Reports ───────────────────────────────────────────────────────────

export const GenerateReportSchema = z.object({
  meeting_id: z.string().uuid(),
})

// ── Document Platform ─────────────────────────────────────────────────

export const UploadTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required').max(200),
  description: z.string().optional(),
  category: z.string().default('attendance_register'),
})

export const UpdateTemplateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  is_default: z.boolean().optional(),
})

export const RenderDocumentSchema = z.object({
  template_id: z.string().uuid().optional().nullable().or(z.literal('')).transform(val => val || undefined),
  format: z.enum(['pdf', 'docx']).default('pdf'),
  version: z.number().int().positive().optional().nullable().transform(val => val ?? undefined),
  document_number: z.string().max(50).optional().nullable().or(z.literal('')).transform(val => val || undefined),
  scope: z.enum(['all', 'staff', 'visitors']).default('all').optional(),
})

export const UpdateOrganizationSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  short_name: z.string().max(50).optional(),
  address: z.string().optional(),
  phone: z.string().max(50).optional(),
  email: z.string().email().optional(),
  website: z.string().max(200).optional(),
  vision: z.string().optional(),
  mission: z.string().optional(),
  core_values: z.string().optional(),
})

// ── Pagination ────────────────────────────────────────────────────────

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

// ── Inferred types ────────────────────────────────────────────────────

export type LoginInput = z.infer<typeof LoginSchema>
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>
export type CreateDepartmentInput = z.infer<typeof CreateDepartmentSchema>
export type UpdateDepartmentInput = z.infer<typeof UpdateDepartmentSchema>
export type CreateUserInput = z.infer<typeof CreateUserSchema>
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>
export type CreateMeetingInput = z.infer<typeof CreateMeetingSchema>
export type UpdateMeetingInput = z.infer<typeof UpdateMeetingSchema>
export type SubmitAttendanceInput = z.infer<typeof SubmitAttendanceSchema>
