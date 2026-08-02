import { supabaseAdmin } from '../config/supabase.js';
// ── List audit logs (ICT Admin only) ──────────────────────────────────
export const listAuditLogs = async (page = 1, limit = 50, filters) => {
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    let query = supabaseAdmin
        .from('audit_logs')
        .select('*, profiles(full_name, email)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);
    if (filters?.userId)
        query = query.eq('user_id', filters.userId);
    if (filters?.action)
        query = query.eq('action', filters.action);
    if (filters?.from)
        query = query.gte('created_at', filters.from);
    if (filters?.to)
        query = query.lte('created_at', filters.to);
    const { data, error, count } = await query;
    if (error)
        throw new Error(error.message);
    return { logs: data, total: count ?? 0 };
};
