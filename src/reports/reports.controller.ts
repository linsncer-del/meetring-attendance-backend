import type { Context } from 'hono'
import * as ReportsService from './reports.service.js'
import {
  ok, created, badRequest, notFound, serverError, paginated,
} from '../utils/response.js'
import { PaginationSchema } from '../utils/validators.js'
import { writeAuditLog } from '../middleware/audit.middleware.js'
import type { HonoVariables } from '../types/index.js'

// POST /api/reports/generate/:meetingId
export const generate = async (c: Context<{ Variables: HonoVariables }>) => {
  try {
    const user = c.get('user')
    const meetingId = c.req.param('meetingId') || ''
    const { report } = await ReportsService.generateReport(meetingId, user.id)

    writeAuditLog(user.id, 'report_generated', `Report generated for meeting: ${meetingId}`,
      c.req.header('x-forwarded-for') ?? undefined)

    // Create in-app notification
    return created(c, {
      message: 'Report generated successfully',
      report,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to generate report'
    return badRequest(c, message)
  }
}

// GET /api/reports
export const list = async (c: Context<{ Variables: HonoVariables }>) => {
  try {
    const user = c.get('user')
    const { page, limit } = PaginationSchema.parse({
      page: c.req.query('page'),
      limit: c.req.query('limit'),
    })
    const { reports, total } = await ReportsService.listReports(
      user.id, user.role, page, limit, c.req.query('status')
    )
    return paginated(c, reports, total, page, limit)
  } catch {
    return serverError(c)
  }
}

// GET /api/reports/:id
export const getOne = async (c: Context<{ Variables: HonoVariables }>) => {
  try {
    const report = await ReportsService.getReportById(c.req.param('id') || '')
    return ok(c, report)
  } catch {
    return notFound(c)
  }
}

// GET /api/reports/:id/download
export const download = async (c: Context<{ Variables: HonoVariables }>) => {
  try {
    const url = await ReportsService.getReportDownloadUrl(c.req.param('id') || '')
    return ok(c, { download_url: url })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Download failed'
    return notFound(c, message)
  }
}

// POST /api/reports/:id/submit-to-hr
export const submitToHR = async (c: Context<{ Variables: HonoVariables }>) => {
  try {
    const user = c.get('user')
    const reportId = c.req.param('id') || ''
    await ReportsService.submitToHR(reportId, user.id)

    writeAuditLog(user.id, 'report_submitted_to_hr', `Report submitted to HR: ${reportId}`,
      c.req.header('x-forwarded-for') ?? undefined)

    return ok(c, { message: 'Report submitted to HR successfully. HR has been notified.' })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Submission failed'
    return badRequest(c, message)
  }
}

// PATCH /api/reports/:id/archive
export const archive = async (c: Context<{ Variables: HonoVariables }>) => {
  try {
    await ReportsService.archiveReport(c.req.param('id') || '')
    return ok(c, { message: 'Report archived' })
  } catch {
    return serverError(c)
  }
}
