import type { Context } from 'hono'
import * as NotifService from './notifications.service.js'
import { ok, serverError } from '../utils/response.js'
import type { HonoVariables } from '../types/index.js'

// GET /api/notifications
export const list = async (c: Context<{ Variables: HonoVariables }>) => {
  try {
    const user = c.get('user')
    const onlyUnread = c.req.query('unread') === 'true'
    const page = Number(c.req.query('page') ?? 1)
    const limit = Number(c.req.query('limit') ?? 30)
    const { notifications, total } = await NotifService.listNotifications(user.id, onlyUnread, page, limit)
    return ok(c, { notifications, total })
  } catch {
    return serverError(c)
  }
}

// GET /api/notifications/unread-count
export const unreadCount = async (c: Context<{ Variables: HonoVariables }>) => {
  try {
    const user = c.get('user')
    const count = await NotifService.countUnread(user.id)
    return ok(c, { unread_count: count })
  } catch {
    return serverError(c)
  }
}

// PATCH /api/notifications/:id/read
export const markRead = async (c: Context<{ Variables: HonoVariables }>) => {
  try {
    const user = c.get('user')
    await NotifService.markAsRead(c.req.param('id') || '', user.id)
    return ok(c, { message: 'Marked as read' })
  } catch {
    return serverError(c)
  }
}

// PATCH /api/notifications/read-all
export const markAllRead = async (c: Context<{ Variables: HonoVariables }>) => {
  try {
    const user = c.get('user')
    await NotifService.markAllAsRead(user.id)
    return ok(c, { message: 'All notifications marked as read' })
  } catch {
    return serverError(c)
  }
}
