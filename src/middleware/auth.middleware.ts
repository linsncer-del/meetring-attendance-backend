import type { Context, Next } from 'hono'
import { supabaseAnon, supabaseAdmin } from '../config/supabase.js'
import { unauthorized } from '../utils/response.js'
import type { HonoVariables } from '../types/index.js'

/**
 * Auth middleware — validates the Bearer JWT and attaches the user
 * profile to the Hono context as `c.get('user')`.
 */
export const authMiddleware = async (
  c: Context<{ Variables: HonoVariables }>,
  next: Next
) => {
  const authHeader = c.req.header('Authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return unauthorized(c, 'Missing or malformed Authorization header')
  }

  const token = authHeader.replace('Bearer ', '').trim()

  // Verify the JWT with Supabase
  const { data: { user }, error } = await supabaseAnon.auth.getUser(token)

  if (error || !user) {
    return unauthorized(c, 'Invalid or expired token')
  }

  // Fetch the app profile (role, department, is_active, etc.)
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return unauthorized(c, 'User profile not found')
  }

  if (!profile.is_active) {
    return unauthorized(c, 'Account is disabled. Contact the ICT Administrator.')
  }

  // Attach to context
  c.set('user', profile)
  c.set('token', token)

  // Update last_login (fire-and-forget — do not await)
  supabaseAdmin
    .from('profiles')
    .update({ last_login: new Date().toISOString() })
    .eq('id', user.id)
    .then(() => {})

  await next()
}
