import { supabaseAdmin, supabaseAnon } from '../config/supabase.js'
import type { Profile } from '../types/index.js'

// ── Sign In ───────────────────────────────────────────────────────────

export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password })
  if (error) throw new Error(error.message)

  // Fetch full profile
  const { data: profile, error: profileErr } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .single()

  if (profileErr || !profile) throw new Error('Profile not found')
  if (!profile.is_active) throw new Error('Account is disabled. Contact the ICT Administrator.')

  return {
    session: data.session,
    user: profile as Profile,
    mustChangePassword: profile.must_change_password,
  }
}

// ── Sign Out ──────────────────────────────────────────────────────────

export const signOut = async (token: string) => {
  // Set the token so Supabase knows which session to revoke
  const client = supabaseAnon
  await client.auth.setSession({ access_token: token, refresh_token: '' })
  const { error } = await client.auth.signOut()
  if (error) throw new Error(error.message)
}

// ── Change Password ───────────────────────────────────────────────────

export const changePassword = async (
  userId: string,
  token: string,
  newPassword: string
) => {
  // Use the user's own session to update their password
  const client = supabaseAnon
  await client.auth.setSession({ access_token: token, refresh_token: '' })
  const { error } = await client.auth.updateUser({ password: newPassword })
  if (error) throw new Error(error.message)

  // Clear the must_change_password flag
  const { error: profileErr } = await supabaseAdmin
    .from('profiles')
    .update({ must_change_password: false, updated_at: new Date().toISOString() })
    .eq('id', userId)

  if (profileErr) throw new Error(profileErr.message)
}

// ── Get Profile ───────────────────────────────────────────────────────

export const getProfile = async (userId: string): Promise<Profile> => {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('*, departments(name, department_code)')
    .eq('id', userId)
    .single()

  if (error || !data) throw new Error('Profile not found')
  return data as Profile
}

// ── Request Password Reset ───────────────────────────────────────────

export const requestPasswordReset = async (email: string, redirectOrigin?: string) => {
  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('email', email.trim().toLowerCase())
    .single()

  if (error || !profile) {
    throw new Error('Access Denied: Account not found. Non-admin users must contact the ICT Administrator.')
  }

  if (profile.role !== 'ict_admin') {
    throw new Error('Access Denied: Non-admin users cannot reset passwords directly. Please contact your ICT Administrator to reset your password.')
  }

  if (!profile.is_active) {
    throw new Error('Account is disabled. Contact the ICT Administrator.')
  }

  const redirectTo = redirectOrigin ? `${redirectOrigin}/reset-password` : undefined
  const { error: resetErr } = await supabaseAnon.auth.resetPasswordForEmail(email, { redirectTo })

  if (resetErr) {
    throw new Error(resetErr.message)
  }

  return {
    success: true,
    message: 'Password reset instructions have been sent to your administrator email address.',
    profile,
  }
}

// ── Reset Password With Token ────────────────────────────────────────

export const resetPasswordWithToken = async (accessToken: string, newPassword: string) => {
  const client = supabaseAnon
  await client.auth.setSession({ access_token: accessToken, refresh_token: '' })
  const { data, error } = await client.auth.updateUser({ password: newPassword })
  if (error) throw new Error(error.message)

  if (data.user?.id) {
    await supabaseAdmin
      .from('profiles')
      .update({ must_change_password: false, updated_at: new Date().toISOString() })
      .eq('id', data.user.id)
  }

  return { success: true, message: 'Password updated successfully' }
}

