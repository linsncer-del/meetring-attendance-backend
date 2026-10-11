import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { attendanceRateLimit } from '../middleware/rateLimit.middleware.js'
import { publicInfo, ask, presentation, list, settings, update, answer, forward } from './qna.controller.js'
import type { HonoVariables } from '../types/index.js'

const qnaRouter = new Hono<{ Variables: HonoVariables }>()

// ── PUBLIC (no login): the ask form and the projector screen ─────────
qnaRouter.get('/public/:meetingId', publicInfo)
qnaRouter.post('/public/:meetingId/questions', attendanceRateLimit, ask)
qnaRouter.get('/public/:meetingId/presentation', presentation)

// ── ORGANISER ─────────────────────────────────────────────────────────
qnaRouter.use('/meetings/*', authMiddleware)
qnaRouter.use('/questions/*', authMiddleware)
qnaRouter.get('/meetings/:meetingId/questions', list)
qnaRouter.patch('/meetings/:meetingId/settings', settings)
qnaRouter.patch('/questions/:questionId', update)
qnaRouter.post('/questions/:questionId/answer', answer)
qnaRouter.post('/questions/:questionId/forward', forward)

export default qnaRouter
