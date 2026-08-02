import { supabaseAdmin } from '../config/supabase.js';
/**
 * Writes an entry to the audit_logs table.
 * Fire-and-forget — never blocks the response.
 */
export const writeAuditLog = (userId, action, details, ipAddress) => {
    (async () => {
        try {
            await supabaseAdmin
                .from('audit_logs')
                .insert({
                user_id: userId,
                action,
                details: details ?? null,
                ip_address: ipAddress ?? null,
            });
        }
        catch (err) {
            console.error('[AuditLog] Failed to write:', err);
        }
    })();
};
/**
 * Middleware factory — logs an action after the handler runs.
 *
 * Usage:
 *   router.post('/', auditLog('meeting_created'), handler)
 */
export const auditLog = (action, detailsFn) => {
    return async (c, next) => {
        await next();
        const user = c.get('user');
        const ip = c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? undefined;
        const details = detailsFn ? detailsFn(c) : undefined;
        writeAuditLog(user?.id ?? null, action, details, ip);
    };
};
