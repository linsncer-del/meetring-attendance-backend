import { forbidden } from '../utils/response.js';
/**
 * Role guard factory.
 *
 * Usage:
 *   router.use('*', requireRole('ict_admin'))
 *   router.use('*', requireRole(['hr_officer', 'ict_admin']))
 */
export const requireRole = (allowed) => {
    const roles = Array.isArray(allowed) ? allowed : [allowed];
    return async (c, next) => {
        const user = c.get('user');
        if (!user) {
            return forbidden(c, 'Authentication required');
        }
        if (!roles.includes(user.role)) {
            return forbidden(c, `Access denied. Required role: ${roles.join(' or ')}`);
        }
        await next();
    };
};
