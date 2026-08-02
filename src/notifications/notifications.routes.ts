import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { list, unreadCount, markRead, markAllRead } from './notifications.controller.js'
import type { HonoVariables } from '../types/index.js'

const notifRouter = new Hono<{ Variables: HonoVariables }>()

notifRouter.use('*', authMiddleware)

notifRouter.get('/', list)
notifRouter.get('/unread-count', unreadCount)
notifRouter.patch('/read-all', markAllRead)
notifRouter.patch('/:id/read', markRead)

export default notifRouter
