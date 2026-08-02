import { supabaseAdmin } from '../config/supabase.js'
import { sendMail, templates } from '../config/mailer.js'
import type { Profile } from '../types/index.js'
import type { CreateUserInput, UpdateUserInput } from '../utils/validators.js'

// ── List users ────────────────────────────────────────────────────────

export const listUsers = async (page = 1, limit = 20) => {
  const from = (page - 1) * limit
  const to = from + limit - 1

  const { data, error, count } = await supabaseAdmin
    .from('profiles')
    .select('*, departments(name, department_code)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) throw new Error(error.message)
  return { users: data as Profile[], total: count ?? 0 }
}

// ── Get single user ───────────────────────────────────────────────────

export const getUserById = async (id: string): Promise<Profile> => {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('*, departments(name, department_code)')
    .eq('id', id)
    .single()

  if (error || !data) throw new Error('User not found')
  return data as Profile
}

// ── Create user ───────────────────────────────────────────────────────

export const createUser = async (input: CreateUserInput): Promise<Profile> => {
  const tempPassword = input.temp_password || 'Admin@2056'

  // 1. Create Supabase Auth user
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: input.email,
    password: tempPassword,
    email_confirm: true,
  })

  if (authError) {
    if (authError.message.includes('already registered')) {
      throw new Error('A user with this email already exists')
    }
    throw new Error(authError.message)
  }

  const userId = authData.user.id

  // 2. Insert profile row
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .insert({
      id: userId,
      full_name: input.full_name,
      email: input.email,
      role: input.role,
      department_id: input.department_id ?? null,
      must_change_password: true,
      is_active: true,
    })
    .select()
    .single()

  if (profileError) {
    // Rollback auth user if profile creation failed
    await supabaseAdmin.auth.admin.deleteUser(userId)
    throw new Error(profileError.message)
  }

  // 3. Send welcome email (fire-and-forget)
  const mailTpl = templates.welcomeNewUser(input.full_name, input.email, tempPassword)
  sendMail({ to: input.email, subject: mailTpl.subject, html: mailTpl.html }).catch(
    err => console.error('[Mailer] Welcome email failed:', err)
  )

  return profile as Profile
}

// ── Update user ───────────────────────────────────────────────────────

export const updateUser = async (id: string, input: UpdateUserInput): Promise<Profile> => {
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.full_name) updates.full_name = input.full_name
  if (input.role) updates.role = input.role
  if (input.department_id !== undefined) updates.department_id = input.department_id

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error || !data) throw new Error('User not found or update failed')
  return data as Profile
}

// ── Disable / Re-enable user ──────────────────────────────────────────

export const setUserActive = async (id: string, isActive: boolean): Promise<void> => {
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw new Error(error.message)

  // Also disable in Supabase Auth
  await supabaseAdmin.auth.admin.updateUserById(id, {
    ban_duration: isActive ? 'none' : '87600h', // ban for 10 years = effectively disabled
  })
}

// ── Admin reset password ──────────────────────────────────────────────

export const adminResetPassword = async (
  id: string,
  tempPassword: string
): Promise<void> => {
  // Fetch profile for email
  const { data: profile, error: profileErr } = await supabaseAdmin
    .from('profiles')
    .select('email, full_name')
    .eq('id', id)
    .single()

  if (profileErr || !profile) throw new Error('User not found')

  // Update password in Supabase Auth
  const { error } = await supabaseAdmin.auth.admin.updateUserById(id, {
    password: tempPassword,
  })
  if (error) throw new Error(error.message)

  // Force password change on next login
  await supabaseAdmin
    .from('profiles')
    .update({ must_change_password: true, updated_at: new Date().toISOString() })
    .eq('id', id)

  // Send notification email (fire-and-forget)
  const mailTpl = templates.passwordReset(profile.full_name, tempPassword)
  sendMail({ to: profile.email, subject: mailTpl.subject, html: mailTpl.html }).catch(
    err => console.error('[Mailer] Password reset email failed:', err)
  )
}
