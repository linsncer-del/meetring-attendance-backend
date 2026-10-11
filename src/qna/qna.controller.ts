import type { Context } from 'hono'
import * as QnaService from './qna.service.js'
import { ok, created, badRequest, notFound } from '../utils/response.js'
import {
  AskQuestionSchema, UpdateQuestionSchema, AnswerQuestionSchema, ForwardQuestionSchema, QnaSettingsSchema,
} from '../utils/validators.js'
import { getClientIp } from '../utils/ip.js'
import type { HonoVariables } from '../types/index.js'

const messageOf = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback)

// ── Public ────────────────────────────────────────────────────────────

// GET /api/qna/public/:meetingId — the ask form's header
export const publicInfo = async (c: Context) => {
  try {
    return ok(c, await QnaService.getPublicQnaInfo(c.req.param('meetingId') || ''))
  } catch {
    return notFound(c, 'Meeting not found')
  }
}

// POST /api/qna/public/:meetingId/questions — ask a question
export const ask = async (c: Context) => {
  try {
    const parsed = AskQuestionSchema.safeParse(await c.req.json())
    if (!parsed.success) return badRequest(c, parsed.error.issues[0].message)
    const result = await QnaService.askQuestion(c.req.param('meetingId') || '', parsed.data, getClientIp(c))
    return created(c, { message: 'Your question has been sent.', ...result })
  } catch (err) {
    return badRequest(c, messageOf(err, 'Could not send your question'))
  }
}

// GET /api/qna/public/:meetingId/presentation — questions put on screen, for the projector
export const presentation = async (c: Context) => {
  try {
    return ok(c, await QnaService.getPresentation(c.req.param('meetingId') || ''))
  } catch {
    return notFound(c, 'Meeting not found')
  }
}

// ── Organiser ─────────────────────────────────────────────────────────

// GET /api/qna/meetings/:meetingId/questions
export const list = async (c: Context<{ Variables: HonoVariables }>) => {
  try {
    const user = c.get('user')
    return ok(c, await QnaService.listQuestions(c.req.param('meetingId') || '', user.id, user.role))
  } catch (err) {
    return badRequest(c, messageOf(err, 'Could not load questions'))
  }
}

// PATCH /api/qna/meetings/:meetingId/settings
export const settings = async (c: Context<{ Variables: HonoVariables }>) => {
  try {
    const parsed = QnaSettingsSchema.safeParse(await c.req.json())
    if (!parsed.success) return badRequest(c, parsed.error.issues[0].message)
    const user = c.get('user')
    await QnaService.setQnaOpen(c.req.param('meetingId') || '', parsed.data.qna_open, user.id, user.role)
    return ok(c, { qna_open: parsed.data.qna_open })
  } catch (err) {
    return badRequest(c, messageOf(err, 'Could not update Q&A settings'))
  }
}

// PATCH /api/qna/questions/:questionId
export const update = async (c: Context<{ Variables: HonoVariables }>) => {
  try {
    const parsed = UpdateQuestionSchema.safeParse(await c.req.json())
    if (!parsed.success) return badRequest(c, parsed.error.issues[0].message)
    const user = c.get('user')
    return ok(c, await QnaService.updateQuestion(c.req.param('questionId') || '', parsed.data, user.id, user.role))
  } catch (err) {
    return badRequest(c, messageOf(err, 'Could not update the question'))
  }
}

// POST /api/qna/questions/:questionId/answer
export const answer = async (c: Context<{ Variables: HonoVariables }>) => {
  try {
    const parsed = AnswerQuestionSchema.safeParse(await c.req.json())
    if (!parsed.success) return badRequest(c, parsed.error.issues[0].message)
    const user = c.get('user')
    return ok(c, await QnaService.answerQuestion(c.req.param('questionId') || '', parsed.data, user.id, user.role))
  } catch (err) {
    return badRequest(c, messageOf(err, 'Could not save the answer'))
  }
}

// POST /api/qna/questions/:questionId/forward
export const forward = async (c: Context<{ Variables: HonoVariables }>) => {
  try {
    const parsed = ForwardQuestionSchema.safeParse(await c.req.json())
    if (!parsed.success) return badRequest(c, parsed.error.issues[0].message)
    const user = c.get('user')
    return ok(c, await QnaService.forwardQuestion(c.req.param('questionId') || '', parsed.data, user.id, user.role))
  } catch (err) {
    return badRequest(c, messageOf(err, 'Could not forward the question'))
  }
}
