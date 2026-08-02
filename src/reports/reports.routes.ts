import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { requireRole } from '../middleware/role.middleware.js'
import { generate, list, getOne, download, submitToHR, archive } from './reports.controller.js'
import type { HonoVariables } from '../types/index.js'

const reportsRouter = new Hono<{ Variables: HonoVariables }>()

reportsRouter.use('*', authMiddleware)

// Generate a report — meeting creator + admins
reportsRouter.post(
  '/generate/:meetingId',
  requireRole(['meeting_creator', 'ict_admin']),
  generate
)

// List reports
reportsRouter.get('/', list)

// Get single report
reportsRouter.get('/:id', getOne)

// Download signed URL
reportsRouter.get('/:id/download', download)

// Submit to HR — meeting creator + admins
reportsRouter.post(
  '/:id/submit-to-hr',
  requireRole(['meeting_creator', 'ict_admin']),
  submitToHR
)

// Archive — HR officers and admins
reportsRouter.patch(
  '/:id/archive',
  requireRole(['hr_officer', 'ict_admin']),
  archive
)

export default reportsRouter
