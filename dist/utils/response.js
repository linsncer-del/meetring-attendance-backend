// ── Success ──────────────────────────────────────────────────────────
export const ok = (c, data, status = 200) => c.json({ success: true, data }, status);
export const created = (c, data) => c.json({ success: true, data }, 201);
export const paginated = (c, data, total, page, limit) => c.json({
    success: true,
    data,
    meta: { total, page, limit, pages: Math.ceil(total / limit) },
});
// ── Errors ───────────────────────────────────────────────────────────
export const badRequest = (c, error) => c.json({ success: false, error }, 400);
export const unauthorized = (c, error = 'Unauthorized') => c.json({ success: false, error }, 401);
export const forbidden = (c, error = 'Forbidden') => c.json({ success: false, error }, 403);
export const notFound = (c, error = 'Not found') => c.json({ success: false, error }, 404);
export const conflict = (c, error) => c.json({ success: false, error }, 409);
export const serverError = (c, error = 'Internal server error') => c.json({ success: false, error }, 500);
