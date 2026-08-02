import type { Context } from 'hono'

// ── Success ──────────────────────────────────────────────────────────

export const ok = <T>(c: Context, data: T, status: 200 | 201 = 200) =>
  c.json({ success: true, data }, status)

export const created = <T>(c: Context, data: T) =>
  c.json({ success: true, data }, 201)

export const paginated = <T>(
  c: Context,
  data: T[],
  total: number,
  page: number,
  limit: number
) =>
  c.json({
    success: true,
    data,
    meta: { total, page, limit, pages: Math.ceil(total / limit) },
  })

// ── Errors ───────────────────────────────────────────────────────────

export const badRequest = (c: Context, error: string) =>
  c.json({ success: false, error }, 400)

export const unauthorized = (c: Context, error = 'Unauthorized') =>
  c.json({ success: false, error }, 401)

export const forbidden = (c: Context, error = 'Forbidden') =>
  c.json({ success: false, error }, 403)

export const notFound = (c: Context, error = 'Not found') =>
  c.json({ success: false, error }, 404)

export const conflict = (c: Context, error: string) =>
  c.json({ success: false, error }, 409)

export const serverError = (c: Context, error = 'Internal server error') =>
  c.json({ success: false, error }, 500)
