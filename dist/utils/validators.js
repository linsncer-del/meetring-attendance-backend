import { z } from 'zod';
// ── Auth ─────────────────────────────────────────────────────────────
export const LoginSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
});
export const ChangePasswordSchema = z.object({
    new_password: z.string().min(8, 'Password must be at least 8 characters'),
    confirm_password: z.string(),
}).refine(d => d.new_password === d.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
});
// ── Departments ───────────────────────────────────────────────────────
export const CreateDepartmentSchema = z.object({
    department_code: z.string().min(1).max(20),
    name: z.string().min(1).max(150),
    description: z.string().optional(),
});
export const UpdateDepartmentSchema = CreateDepartmentSchema.partial();
// ── Users / Profiles ─────────────────────────────────────────────────
export const CreateUserSchema = z.object({
    full_name: z.string().min(1).max(150),
    email: z.string().email().refine(e => e.endsWith('@kenha.co.ke'), {
        message: 'Must be an official KeNHA email (@kenha.co.ke)',
    }),
    role: z.enum(['ict_admin', 'hr_officer', 'meeting_creator', 'Staff']),
    department_id: z.string().uuid().optional(),
    temp_password: z.string().min(8, 'Temporary password must be at least 8 characters').default('Admin@2056').optional(),
});
export const UpdateUserSchema = z.object({
    full_name: z.string().min(1).max(150).optional(),
    role: z.enum(['ict_admin', 'hr_officer', 'meeting_creator', 'Staff']).optional(),
    department_id: z.string().uuid().nullable().optional(),
});
// ── Meetings ──────────────────────────────────────────────────────────
export const CreateMeetingSchema = z.object({
    title: z.string().min(1, 'Title is required').max(200),
    description: z.string().optional().nullable().or(z.literal('')),
    meeting_type: z.enum(['physical', 'virtual', 'hybrid']),
    venue: z.string().max(255).optional().nullable().or(z.literal('')),
    virtual_link: z.string().optional().nullable().or(z.literal('')),
    meeting_date: z.string().min(1, 'Meeting date is required'),
    start_time: z.string().min(1, 'Start time is required'),
    end_time: z.string().min(1, 'End time is required'),
    attendance_open_time: z.string().min(1, 'Attendance open time is required'),
    attendance_close_time: z.string().min(1, 'Attendance close time is required'),
    department_id: z.string().optional().nullable().or(z.literal('')),
    meeting_pin: z.string().optional().nullable().or(z.literal('')),
});
export const UpdateMeetingSchema = CreateMeetingSchema.partial();
// ── Attendance — Staff ────────────────────────────────────────────────
export const SubmitStaffAttendanceSchema = z.object({
    meeting_id: z.string().uuid(),
    meeting_pin: z.string().min(1, 'PIN is required'),
    participant_type: z.literal('staff'),
    full_name: z.string().min(1).max(150),
    designation: z.string().min(1).max(150),
    department_id: z.string().uuid(),
    signature_data: z.string().min(1, 'Digital signature is required'),
});
// ── Attendance — Visitor ──────────────────────────────────────────────
export const SubmitVisitorAttendanceSchema = z.object({
    meeting_id: z.string().uuid(),
    meeting_pin: z.string().min(1, 'PIN is required'),
    participant_type: z.literal('visitor'),
    full_name: z.string().min(1).max(150),
    organization: z.string().min(1).max(200),
    position_title: z.string().max(150).optional(),
    purpose: z.enum(['guest', 'consultant', 'contractor', 'partner', 'trainer', 'auditor', 'other']),
    signature_data: z.string().min(1, 'Digital signature is required'),
});
export const SubmitAttendanceSchema = z.discriminatedUnion('participant_type', [
    SubmitStaffAttendanceSchema,
    SubmitVisitorAttendanceSchema,
]);
// ── Reports ───────────────────────────────────────────────────────────
export const GenerateReportSchema = z.object({
    meeting_id: z.string().uuid(),
});
// ── Pagination ────────────────────────────────────────────────────────
export const PaginationSchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});
