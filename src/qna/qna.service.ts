import { supabaseAdmin } from '../config/supabase.js'
import { sendMail, templates } from '../config/mailer.js'
import { sanitizeIp } from '../utils/ip.js'

// =====================================================================
// Meeting Q&A
// Attendees ask questions through a public link / QR code. The meeting's
// organiser (and HR / ICT admins) moderate them: show on the projector,
// highlight one full-screen, answer (optionally emailing the asker), forward
// to whoever should answer, or dismiss.
// =====================================================================

export type QuestionStatus = 'pending' | 'answered' | 'dismissed'

const PUBLIC_QUESTION_FIELDS = 'question_id, question, asker_name, status, on_screen, is_highlighted, answer, answered_at, created_at'

// ── Access ────────────────────────────────────────────────────────────

const getMeeting = async (meetingId: string) => {
  const { data, error } = await supabaseAdmin
    .from('meetings')
    .select('meeting_id, title, created_by, qna_open, departments(name), department_label')
    .eq('meeting_id', meetingId)
    .single()
  if (error || !data) throw new Error('Meeting not found')
  return data as any
}

// The organiser who created the meeting, HR officers and ICT admins.
const assertCanModerate = (meeting: { created_by: string }, userId: string, role: string) => {
  if (role === 'ict_admin' || role === 'hr_officer') return
  if (meeting.created_by !== userId) throw new Error('You can only manage questions for meetings you created')
}

const getQuestionWithMeeting = async (questionId: string) => {
  const { data, error } = await supabaseAdmin
    .from('meeting_questions')
    .select('*')
    .eq('question_id', questionId)
    .single()
  if (error || !data) throw new Error('Question not found')
  const meeting = await getMeeting(data.meeting_id)
  return { question: data as any, meeting }
}

const displayNameOf = async (userId: string) => {
  const { data } = await supabaseAdmin.from('profiles').select('full_name, email').eq('id', userId).single()
  return { name: data?.full_name || 'Meeting Organiser', email: data?.email || null }
}

// ── Public: the ask form ──────────────────────────────────────────────

export const getPublicQnaInfo = async (meetingId: string) => {
  const m = await getMeeting(meetingId)
  return {
    meeting_id: m.meeting_id,
    title: m.title,
    department: m.departments?.name || m.department_label || '',
    qna_open: m.qna_open !== false,
  }
}

export const askQuestion = async (
  meetingId: string,
  input: { question: string; asker_name?: string; asker_email?: string },
  ipAddress?: string
) => {
  const meeting = await getMeeting(meetingId)
  if (meeting.qna_open === false) throw new Error('Questions are closed for this meeting.')

  const { data, error } = await supabaseAdmin
    .from('meeting_questions')
    .insert({
      meeting_id: meetingId,
      question: input.question.trim(),
      asker_name: input.asker_name?.trim() || null,
      asker_email: input.asker_email?.trim().toLowerCase() || null,
      ip_address: sanitizeIp(ipAddress),
    })
    .select('question_id')
    .single()
  if (error) throw new Error(error.message)
  return data
}

// ── Public: the presentation screen ───────────────────────────────────
// Only questions the organiser put on screen — never emails.

export const getPresentation = async (meetingId: string) => {
  const meeting = await getPublicQnaInfo(meetingId)
  const { data, error } = await supabaseAdmin
    .from('meeting_questions')
    .select(PUBLIC_QUESTION_FIELDS)
    .eq('meeting_id', meetingId)
    .eq('on_screen', true)
    .neq('status', 'dismissed')
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return { meeting, questions: data ?? [] }
}

// ── Organiser ─────────────────────────────────────────────────────────

export const listQuestions = async (meetingId: string, userId: string, role: string) => {
  const meeting = await getMeeting(meetingId)
  assertCanModerate(meeting, userId, role)
  const { data, error } = await supabaseAdmin
    .from('meeting_questions')
    .select('*')
    .eq('meeting_id', meetingId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return {
    meeting: { meeting_id: meeting.meeting_id, title: meeting.title, qna_open: meeting.qna_open !== false },
    questions: data ?? [],
  }
}

export const setQnaOpen = async (meetingId: string, open: boolean, userId: string, role: string) => {
  const meeting = await getMeeting(meetingId)
  assertCanModerate(meeting, userId, role)
  const { error } = await supabaseAdmin.from('meetings').update({ qna_open: open }).eq('meeting_id', meetingId)
  if (error) throw new Error(error.message)
}

export const updateQuestion = async (
  questionId: string,
  patch: { status?: QuestionStatus; on_screen?: boolean; is_highlighted?: boolean },
  userId: string,
  role: string
) => {
  const { question, meeting } = await getQuestionWithMeeting(questionId)
  assertCanModerate(meeting, userId, role)

  const update: Record<string, any> = {}
  if (patch.status) update.status = patch.status
  if (typeof patch.on_screen === 'boolean') update.on_screen = patch.on_screen
  if (typeof patch.is_highlighted === 'boolean') update.is_highlighted = patch.is_highlighted

  // A dismissed question leaves the screen; restoring it does not put it back.
  if (patch.status === 'dismissed') {
    update.on_screen = false
    update.is_highlighted = false
  }
  // Highlighting puts a question on screen (un-dismissing it if needed).
  if (patch.is_highlighted === true) {
    update.on_screen = true
    if (question.status === 'dismissed') update.status = 'pending'
  }
  // Taken off the screen → cannot stay highlighted on it.
  if (update.on_screen === false) update.is_highlighted = false

  // Only one question is highlighted per meeting at a time.
  if (update.is_highlighted === true) {
    await supabaseAdmin
      .from('meeting_questions')
      .update({ is_highlighted: false })
      .eq('meeting_id', question.meeting_id)
      .neq('question_id', questionId)
  }

  const { data, error } = await supabaseAdmin
    .from('meeting_questions')
    .update(update)
    .eq('question_id', questionId)
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data
}

export const answerQuestion = async (
  questionId: string,
  input: { answer: string; email_asker?: boolean },
  userId: string,
  role: string
) => {
  const { question, meeting } = await getQuestionWithMeeting(questionId)
  assertCanModerate(meeting, userId, role)

  const now = new Date().toISOString()
  const update: Record<string, any> = {
    answer: input.answer.trim(),
    answered_by: userId,
    answered_at: now,
    status: 'answered',
  }

  let emailed = false
  if (input.email_asker) {
    if (!question.asker_email) throw new Error('This question was asked without an email address.')
    const me = await displayNameOf(userId)
    const tpl = templates.qnaAnswer(question.asker_name, meeting.title, question.question, update.answer, me.name)
    await sendMail({ to: question.asker_email, subject: tpl.subject, html: tpl.html, replyTo: me.email ?? undefined })
    update.answer_emailed_at = now
    emailed = true
  }

  const { data, error } = await supabaseAdmin
    .from('meeting_questions')
    .update(update)
    .eq('question_id', questionId)
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return { question: data, emailed }
}

export const forwardQuestion = async (
  questionId: string,
  input: { email: string; note?: string },
  userId: string,
  role: string
) => {
  const { question, meeting } = await getQuestionWithMeeting(questionId)
  assertCanModerate(meeting, userId, role)

  const me = await displayNameOf(userId)
  const tpl = templates.qnaForward(
    input.note?.trim() || null,
    meeting.title,
    question.question,
    question.asker_name,
    question.asker_email,
    me.name
  )
  // Replies go straight to the asker; for an anonymous question, to the organiser.
  await sendMail({
    to: input.email.trim(),
    subject: tpl.subject,
    html: tpl.html,
    replyTo: question.asker_email || me.email || undefined,
  })

  const { data, error } = await supabaseAdmin
    .from('meeting_questions')
    .update({ forwarded_to: input.email.trim().toLowerCase(), forwarded_by: userId, forwarded_at: new Date().toISOString() })
    .eq('question_id', questionId)
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data
}
