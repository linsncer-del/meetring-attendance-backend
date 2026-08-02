import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { requireRole } from '../middleware/role.middleware.js'
import {
  list, getOne, create, update, disable, enable, resetPassword,
} from './users.controller.js'
import type { HonoVariables } from '../types/index.js'

const usersRouter = new Hono<{ Variables: HonoVariables }>()

// All routes require auth
usersRouter.use('*', authMiddleware)

// ICT Admin only
usersRouter.get('/', requireRole('ict_admin'), list)
usersRouter.post('/', requireRole('ict_admin'), create)
usersRouter.patch('/:id', requireRole('ict_admin'), update)
usersRouter.patch('/:id/disable', requireRole('ict_admin'), disable)
usersRouter.patch('/:id/enable', requireRole('ict_admin'), enable)
usersRouter.post('/:id/reset-password', requireRole('ict_admin'), resetPassword)

// Any authenticated user can view a specific profile (e.g. their own)
usersRouter.get('/:id', getOne)

export default usersRouter
