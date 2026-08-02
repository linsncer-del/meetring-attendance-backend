import 'dotenv/config'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { generalRateLimit } from './middleware/rateLimit.middleware.js'
import { metricsMiddleware, registry } from './middleware/metrics.middleware.js'

// ── Route modules ─────────────────────────────────────────────────────
import authRouter from './Auth/Authroutes.js'
import deptRouter from './departments/departments.routes.js'
import usersRouter from './users/users.routes.js'
import meetingsRouter from './meetings/meetings.routes.js'
import attendanceRouter from './attendance/attendance.routes.js'
import reportsRouter from './reports/reports.routes.js'
import notifRouter from './notifications/notifications.routes.js'
import auditRouter from './audit/audit.routes.js'

import type { HonoVariables } from './types/index.js'

// ── App ───────────────────────────────────────────────────────────────

const app = new Hono<{ Variables: HonoVariables }>()

// ── Global Middleware ─────────────────────────────────────────────────

app.use('*', logger())

app.use(
  '*',
  cors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 600,
  })
)

// Records request count + duration for every request, labeled by
// method/route/status, so Prometheus can scrape it via /metrics below.
app.use('*', metricsMiddleware)

app.use('/api/*', generalRateLimit)

// ── Health Check ──────────────────────────────────────────────────────

app.get('/', c =>
  c.json({
    name: 'KMTAMS API',
    description: 'KeNHA Meeting & Training Attendance Management System',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
  })
)

app.get('/api/health', c =>
  c.json({ status: 'ok', timestamp: new Date().toISOString() })
)

// ── Prometheus metrics endpoint ────────────────────────────────────────
// Scrape target for Prometheus: GET /metrics
app.get('/metrics', async c => {
  const metrics = await registry.metrics()
  return c.text(metrics, 200, { 'Content-Type': registry.contentType })
})

// ── API Routes ────────────────────────────────────────────────────────

app.route('/api/auth', authRouter)
app.route('/api/departments', deptRouter)
app.route('/api/users', usersRouter)
app.route('/api/meetings', meetingsRouter)
app.route('/api/attendance', attendanceRouter)
app.route('/api/reports', reportsRouter)
app.route('/api/notifications', notifRouter)
app.route('/api/audit', auditRouter)

// ── 404 handler ───────────────────────────────────────────────────────

app.notFound(c =>
  c.json({ success: false, error: `Route not found: ${c.req.method} ${c.req.path}` }, 404)
)

// ── Global error handler ──────────────────────────────────────────────

app.onError((err, c) => {
  console.error('[Unhandled Error]', err)
  return c.json({ success: false, error: 'An unexpected error occurred' }, 500)
})

// ── Start server ──────────────────────────────────────────────────────

import { verifyDbConnection } from './config/supabase.js'

const PORT = Number(process.env.PORT) || 3000

const startServer = async () => {
  console.log('🔄 Checking database connection...')

  try {
    await verifyDbConnection()
    console.log('✅ Database connection verified successfully!')
    console.log(`   Supabase URL: ${process.env.SUPABASE_URL ?? '(not set)'}`)
  } catch (err: any) {
    console.error('\n❌ FATAL: Failed to connect to the database. The server will not start.')
    console.error(`   Reason: ${err.message}`)
    console.error('   Please configure your database credentials in the .env file.\n')
    process.exit(1)
  }

  serve({ fetch: app.fetch, port: PORT }, info => {
    console.log(`\n🚀 KMTAMS API running at http://localhost:${info.port}`)
    console.log(`   Environment  : ${process.env.NODE_ENV ?? 'development'}`)
    console.log(`   Frontend URL : ${process.env.FRONTEND_URL ?? 'http://localhost:5173'}`)
    console.log(`   Metrics      : http://localhost:${info.port}/metrics\n`)
  })
}

startServer()

export default app