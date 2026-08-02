import type { Context, Next } from 'hono'
import { forbidden } from '../utils/response.js'
import type { AppRole, HonoVariables } from '../types/index.js'

/**
 * Role guard factory.
 *
 * Usage:
 *   router.use('*', requireRole('ict_admin'))
 *   router.use('*', requireRole(['hr_officer', 'ict_admin']))
 */
export const requireRole = (allowed: AppRole | AppRole[]) => {
  const roles = Array.isArray(allowed) ? allowed : [allowed]

  return async (
    c: Context<{ Variables: HonoVariables }>,
    next: Next
  ) => {
    const user = c.get('user')

    if (!user) {
      return forbidden(c, 'Authentication required')
    }

    if (!roles.includes(user.role)) {
      return forbidden(
        c,
        `Access denied. Required role: ${roles.join(' or ')}`
      )
    }

    await next()
  }
}
