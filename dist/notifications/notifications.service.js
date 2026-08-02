import { supabaseAdmin } from '../config/supabase.js';
// ── List own notifications ─────────────────────────────────────────────
export const listNotifications = async (userId, onlyUnread = false, page = 1, limit = 30) => {
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    let query = supabaseAdmin
        .from('notifications')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(from, to);
    if (onlyUnread)
        query = query.eq('is_read', false);
    const { data, error, count } = await query;
    if (error)
        throw new Error(error.message);
    return { notifications: data, total: count ?? 0 };
};
// ── Count unread ────────────────────────────────────────────────────────
export const countUnread = async (userId) => {
    const { count, error } = await supabaseAdmin
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false);
    if (error)
        throw new Error(error.message);
    return count ?? 0;
};
// ── Mark one as read ──────────────────────────────────────────────────────
export const markAsRead = async (notificationId, userId) => {
    const { error } = await supabaseAdmin
        .from('notifications')
        .update({ is_read: true })
        .eq('notification_id', notificationId)
        .eq('user_id', userId); // ensure ownership
    if (error)
        throw new Error(error.message);
};
// ── Mark all as read ──────────────────────────────────────────────────────
export const markAllAsRead = async (userId) => {
    const { error } = await supabaseAdmin
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);
    if (error)
        throw new Error(error.message);
};
